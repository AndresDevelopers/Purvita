import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { CommissionCalculatorService } from '@/modules/multilevel/services/commission-calculator-service';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';
import { logger } from '@/lib/utils/logger';
import { IPGeolocationService } from '@/lib/services/ip-geolocation-service';
import { FraudAlertService } from '@/lib/services/fraud-alert-service';
import { encryptIP } from '@/lib/security/ip-encryption';
import { PaymentRiskService } from '@/lib/services/payment-risk-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { rateLimit } from '@/lib/utils/rate-limit';

const CartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

const ChargeRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default(PAYMENT_CONSTANTS.CURRENCIES.DEFAULT),
  description: z.string().optional(),
  cartItems: z.array(CartItemSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  deviceFingerprint: z.string().optional(), // Browser fingerprint for fraud detection
});

export async function POST(request: NextRequest) {
  logger.debug('Wallet charge request received');

  try {
    // ✅ SECURITY FIX #1: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      logger.security('CSRF validation failed for wallet charge', {
        path: '/api/payments/wallet/charge',
        method: 'POST',
      });
      return csrfError;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('Unauthorized wallet charge attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ SECURITY FIX #2: Rate limit wallet charges per user (5 charges / 60 seconds)
    const rateLimitResult = await rateLimit(user.id, {
      limit: 5,
      window: 60,
      prefix: 'wallet:charge'
    });

    if (!rateLimitResult.success) {
      logger.security('Rate limit exceeded for wallet charge', {
        userId: user.id,
        limit: rateLimitResult.limit,
        reset: rateLimitResult.reset,
      });

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'You have exceeded the rate limit for wallet charges. Please try again later.',
          retryAfter: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': (rateLimitResult.reset - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }

    const payload = await request.json();
    const { amount, currency, description, cartItems, metadata, deviceFingerprint } = ChargeRequestSchema.parse(payload);

    logger.debug('Processing wallet charge', { amount, currency, itemCount: cartItems?.length });

    const adminClient = createAdminClient();
    const walletService = new WalletService(adminClient);
    const amountCents = Math.round(amount * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS);

    if (amountCents <= 0) {
      logger.warn('Invalid amount in wallet charge', { userId: user.id, amountCents });
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // ============================================================================
    // FRAUD DETECTION - Get IP and Geolocation
    // ============================================================================
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (realIp || '127.0.0.1');
    const userAgent = request.headers.get('user-agent') || '';

    // Geolocate IP
    const geoData = await IPGeolocationService.getCompleteGeolocation(ipAddress);

    // Create device fingerprint hash
    const deviceFingerprintHash = deviceFingerprint
      ? createHash('sha256').update(deviceFingerprint).digest('hex')
      : null;

    const userAgentHash = createHash('sha256').update(userAgent).digest('hex');

    // ============================================================================
    // FRAUD DETECTION - Check for suspicious patterns
    // ============================================================================
    const fraudCheck = await adminClient.rpc('check_wallet_fraud_indicators', {
      p_user_id: user.id,
      p_current_country_code: geoData.countryCode,
      p_device_fingerprint: deviceFingerprintHash,
    });

    if (fraudCheck.error) {
      logger.error('Fraud check failed', fraudCheck.error as Error, { userId: user.id });
    }

    const riskScore = fraudCheck.data?.risk_score || 0;
    const riskLevel = fraudCheck.data?.risk_level || 'minimal';
    const shouldBlock = fraudCheck.data?.should_block_transaction || false;
    const riskFactors = fraudCheck.data?.risk_factors || [];

    logger.security('Fraud check completed', {
      userId: user.id,
      riskScore,
      riskLevel,
      countryCode: geoData.countryCode,
      isVpn: geoData.isVpn,
    });

    // ============================================================================
    // BLOCK TRANSACTION if critical risk or blacklisted
    // ============================================================================
    if (shouldBlock || fraudCheck.data?.is_blacklisted) {
      logger.security('Transaction blocked due to fraud risk', {
        userId: user.id,
        riskScore,
        riskLevel,
        isBlacklisted: fraudCheck.data?.is_blacklisted,
      });

      // Send alert to admins
      await FraudAlertService.sendBlockedTransactionAlert({
        userId: user.id,
        riskScore,
        riskLevel,
        riskFactors,
        stats: fraudCheck.data?.stats || {},
        amountCents,
        currency,
        type: 'wallet_charge',
      });

      return NextResponse.json({
        error: 'Transaction blocked for security review',
        reason: fraudCheck.data?.is_blacklisted
          ? 'Account is restricted due to previous security concerns'
          : 'Unusual activity detected on your account',
        riskLevel,
        contactSupport: true,
      }, { status: 403 });
    }

    // Send alert for high risk (but don't block)
    if (riskLevel === 'high') {
      await FraudAlertService.sendAlert({
        userId: user.id,
        riskScore,
        riskLevel,
        riskFactors,
        stats: fraudCheck.data?.stats || {},
        transactionDetails: {
          amountCents,
          currency,
          type: 'wallet_charge',
        },
      });
    }

    // ============================================================================
    // 3D SECURE / 2FA - Additional verification for high-risk transactions
    // ============================================================================
    const riskAssessment = await PaymentRiskService.assessRisk({
      userId: user.id,
      amountCents,
      currency,
      ipAddress,
      countryCode: geoData.countryCode,
      paymentMethod: 'wallet',
    });

    console.log('[Wallet Charge] Risk assessment:', {
      userId: user.id,
      amountCents,
      riskScore: riskAssessment.riskScore,
      riskLevel: riskAssessment.riskLevel,
      requiresStrongAuth: riskAssessment.requiresStrongAuth,
      factorsCount: riskAssessment.riskFactors.length,
    });

    // If high-risk transaction, require additional verification
    if (riskAssessment.requiresStrongAuth) {
      logger.security('High-risk wallet transaction requires additional verification', {
        userId: user.id,
        amountCents,
        riskScore: riskAssessment.riskScore,
        riskLevel: riskAssessment.riskLevel,
      });

      // TODO: Implement 2FA verification flow
      // For now, we'll return a response indicating verification is required
      // In a full implementation, this would:
      // 1. Generate a verification code
      // 2. Send it via email/SMS
      // 3. Store it in a pending_verifications table
      // 4. Return a verification_required status
      // 5. Have a separate endpoint to verify the code and complete the transaction

      return NextResponse.json({
        status: 'verification_required',
        message: 'This transaction requires additional verification for security',
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        riskFactors: riskAssessment.riskFactors.map(f => ({
          type: f.type,
          severity: f.severity,
          description: f.description,
        })),
        recommendation: riskAssessment.recommendation,
        // In production, you would include:
        // verificationId: generatedVerificationId,
        // verificationMethod: 'email' | 'sms' | 'totp',
      }, { status: 202 }); // 202 Accepted - requires further action
    }

    logger.payment('initiated', 'wallet', { userId: user.id, amountCents, currency, riskScore });

    // Create order in database
    const orderId = randomUUID();
    logger.debug('Creating order', { orderId, userId: user.id });

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .insert({
        id: orderId,
        user_id: user.id,
        status: 'paid',
        total_cents: amountCents,
        currency,
        gateway: 'wallet',
        metadata: metadata || {},
      })
      .select()
      .single();

    if (orderError) {
      logger.error('Order creation failed', orderError as Error, { userId: user.id, orderId });
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    logger.debug('Order created successfully', { orderId });

    // Create order items if cart items provided
    if (cartItems && cartItems.length > 0) {
      logger.debug('Creating order items', { orderId, itemCount: cartItems.length });

      // ✅ SECURITY: Validate prices on server - NEVER trust client prices
      const productIds = cartItems.map(item => item.productId);
      const { data: products, error: productsError } = await adminClient
        .from('products')
        .select('id, price')
        .in('id', productIds);

      if (productsError || !products) {
        logger.error('Failed to fetch product prices', productsError as Error, { 
          orderId, 
          productIds,
          errorCode: productsError?.code,
          errorMessage: productsError?.message,
          errorDetails: productsError?.details,
        });
        return NextResponse.json({
          error: 'Failed to validate product prices',
          details: productsError?.message || 'Products not found in database',
        }, { status: 500 });
      }

      // Log found products for debugging
      logger.debug('Products found for validation', { 
        orderId, 
        requestedIds: productIds, 
        foundIds: products.map(p => p.id),
        foundCount: products.length,
      });

      // Create price map for validation (convert price from dollars to cents)
      const priceMap = new Map(products.map(p => [p.id, { 
        priceCents: Math.round(Number(p.price) * 100), // Convert dollars to cents
      }]));

      // Validate all prices and calculate server-side total
      let calculatedTotalCents = 0;
      const validatedItems = [];

      for (const item of cartItems) {
        const serverProduct = priceMap.get(item.productId);

        if (!serverProduct) {
          logger.warn('Product not found in price validation', { productId: item.productId, orderId });
          return NextResponse.json({
            error: 'Product not found',
            productId: item.productId
          }, { status: 404 });
        }

        // ✅ CRITICAL: Validate client price matches server price
        if (item.priceCents !== serverProduct.priceCents) {
          logger.warn('Price mismatch detected', {
            productId: item.productId,
            clientPrice: item.priceCents,
            serverPrice: serverProduct.priceCents,
            orderId,
            userId: user.id
          });

          // Log potential fraud attempt
          logger.security('Price manipulation attempt detected', {
            userId: user.id,
            productId: item.productId,
            attemptedPrice: item.priceCents,
            actualPrice: serverProduct.priceCents,
            orderId
          });

          return NextResponse.json({
            error: 'Price mismatch detected. Please refresh your cart.',
            details: {
              productId: item.productId,
              expectedPrice: serverProduct.priceCents / 100,
              receivedPrice: item.priceCents / 100
            }
          }, { status: 400 });
        }

        // Calculate total with server prices
        calculatedTotalCents += serverProduct.priceCents * item.quantity;

        // Use validated server price
        validatedItems.push({
          order_id: orderId,
          product_id: item.productId,
          qty: item.quantity,
          price_cents: serverProduct.priceCents, // ✅ Server price, not client
        });
      }

      // ✅ CRITICAL: Validate total amount matches calculated total
      const tolerance = 1; // Allow 1 cent tolerance for rounding
      if (Math.abs(calculatedTotalCents - amountCents) > tolerance) {
        logger.warn('Total amount mismatch', {
          clientTotal: amountCents,
          serverTotal: calculatedTotalCents,
          difference: Math.abs(calculatedTotalCents - amountCents),
          orderId,
          userId: user.id
        });

        logger.security('Total manipulation attempt detected', {
          userId: user.id,
          attemptedTotal: amountCents,
          calculatedTotal: calculatedTotalCents,
          orderId
        });

        return NextResponse.json({
          error: 'Total amount mismatch. Please refresh your cart.',
          details: {
            expectedTotal: calculatedTotalCents / 100,
            receivedTotal: amountCents / 100
          }
        }, { status: 400 });
      }

      // Insert validated items with server prices
      const { error: itemsError } = await adminClient
        .from('order_items')
        .insert(validatedItems);

      if (itemsError) {
        logger.error('Order items creation failed', itemsError as Error, { orderId });
        // Don't fail the whole transaction, just log the error
      } else {
        logger.debug('Order items created with validated prices', { orderId, itemCount: cartItems.length });
      }
    }

    // Process wallet payment with atomic debit (prevents race conditions)
    const spendResult = await walletService.spendFunds(user.id, amountCents, {
      type: 'checkout_payment',
      description: description ?? null,
      currency,
      order_id: orderId,
    });

    // ============================================================================
    // FRAUD TRACKING - Record transaction with fraud metadata
    // ============================================================================
    try {
      const ipEncrypted = await encryptIP(ipAddress);

      // Update the transaction record with fraud detection data
      await adminClient
        .from('wallet_txns')
        .update({
          ip_address_encrypted: ipEncrypted,
          device_fingerprint: deviceFingerprintHash,
          country_code: geoData.countryCode,
          user_agent_hash: userAgentHash,
        })
        .eq('id', spendResult.transactionId);
    } catch (error) {
      logger.error('Failed to update transaction with fraud metadata', error as Error);
      // Don't fail transaction if metadata update fails
    }

    logger.payment('completed', 'wallet', {
      userId: user.id,
      orderId,
      amountCents,
      newBalanceCents: spendResult.newBalanceCents,
    });

    try {
      const commissionService = new CommissionCalculatorService(adminClient);
      await commissionService.calculateAndCreateCommissions(user.id, amountCents, {
        orderId,
        orderMetadata: metadata ?? null,
      });
    } catch (commissionError) {
      logger.error('Failed to create network commissions', commissionError as Error, { userId: user.id, orderId });
    }

    return NextResponse.json({
      status: 'completed',
      orderId: order.id,
      remainingBalanceCents: spendResult.newBalanceCents,
      transactionId: spendResult.transactionId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Wallet charge validation error', { errors: error.flatten().fieldErrors });
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.flatten().fieldErrors,
      }, { status: 400 });
    }

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Insufficient wallet balance')) {
        logger.payment('failed', 'wallet', { reason: 'insufficient_balance' });
        return NextResponse.json({
          error: 'Insufficient wallet balance',
        }, { status: 400 });
      }

      if (error.message.includes('Wallet not found')) {
        logger.error('Wallet not found', error);
        return NextResponse.json({
          error: 'Wallet not found. Please contact support.',
        }, { status: 404 });
      }

      logger.error('Wallet charge failed', error);
    } else {
      logger.error('Wallet charge failed with unknown error', new Error(String(error)));
    }

    // Generic error message (no stack traces in production)
    return NextResponse.json({
      error: 'Unable to process wallet payment',
    }, { status: 500 });
  }
}
