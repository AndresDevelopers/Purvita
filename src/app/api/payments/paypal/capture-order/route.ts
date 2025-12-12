import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GatewayCredentialsService } from '@/modules/payments/services/gateway-credentials-service';
import { PaymentError } from '@/modules/payments/utils/payment-errors';
import { createClient } from '@/lib/supabase/server';
import { createSubscriptionLifecycleService } from '@/modules/multilevel/factories/subscription-service-factory';
import { createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { OrderCreationService } from '@/modules/orders/services/order-creation-service';
import { OrderNotificationService } from '@/modules/orders/services/order-notification-service';
import { decodeCustomIdWithFallback, deleteCustomId } from '@/lib/security/custom-id-encoder';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const CaptureOrderSchema = z.object({
  orderId: z.string(),
  isTest: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Decode custom_id using secure HMAC-based decoder with legacy fallback
 * This replaces the old insecure string parsing
 */
async function decodeCustomId(customId: string | null | undefined): Promise<{
  userId?: string;
  walletUserId?: string;
  rewardType?: string;
  discountCents?: number;
}> {
  if (!customId) return {};

  try {
    // Try secure decoder first (with legacy fallback)
    const decoded = await decodeCustomIdWithFallback(customId);

    if (!decoded) {
      console.warn(`[PayPal Capture] Failed to decode custom_id: ${customId}`);
      return {};
    }

    // Map to expected format
    if (decoded.intent === 'wallet_recharge') {
      return { walletUserId: decoded.userId };
    }

    if (decoded.intent === 'checkout') {
      return {
        userId: decoded.userId,
        rewardType: decoded.rewardType,
        discountCents: decoded.discountCents,
      };
    }

    if (decoded.intent === 'subscription') {
      return { userId: decoded.userId };
    }

    return {};
  } catch (error) {
    console.error('[PayPal Capture] Failed to decode custom_id:', error);
    return {};
  }
}

export async function POST(request: Request) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    const body = await request.json();
    const { orderId, isTest, metadata: requestMetadata } = CaptureOrderSchema.parse(body);

    // Get user ID from auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    const requestedEnvironment = isTest === true ? 'test' : isTest === false ? 'live' : 'auto';
    const { credentials, record } = await GatewayCredentialsService.getProviderCredentials(
      'paypal',
      requestedEnvironment,
    );

    if (record.status !== 'active') {
      return NextResponse.json(
        { error: 'PayPal is not active' },
        { status: 400 },
      );
    }

    const { client_id, client_secret } = credentials;
    const baseUrl = client_id.includes('sandbox')
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    // Get access token with timeout
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!authResponse.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Capture the order with timeout
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json().catch(() => ({}));
      console.error('[PayPal Capture] Capture failed:', errorData);
      throw new Error(errorData.message || 'Failed to capture PayPal order');
    }

    const captureData = await captureResponse.json();
    console.log('[PayPal Capture] Order captured successfully:', captureData.id);

    // Extract payment information
    const purchaseUnit = captureData.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    const customId = purchaseUnit?.custom_id;

    if (!capture) {
      throw new Error('No capture information found in PayPal response');
    }

    const amountCents = Math.round(parseFloat(capture.amount.value) * 100);
    const gatewayRef = capture.id;

    // Decode custom_id to get user info and metadata
    const { userId, walletUserId, rewardType, discountCents } = await decodeCustomId(customId);

    // ✅ CRITICAL SECURITY FIX: Validate ownership - userId from order must match authenticated user
    const orderUserId = userId || walletUserId;

    if (orderUserId && currentUserId && orderUserId !== currentUserId) {
      console.error('[PayPal Capture] ❌ SECURITY: Order ownership mismatch detected', {
        orderUserId,
        currentUserId,
        orderId,
        captureId: capture.id,
      });

      // Attempt to refund the unauthorized capture
      try {
        const refundResponse = await fetch(`${baseUrl}/v2/payments/captures/${capture.id}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            note_to_payer: 'Refund due to security verification failure',
          }),
        });

        if (refundResponse.ok) {
          console.log('[PayPal Capture] ✅ Unauthorized payment refunded successfully');
        } else {
          console.error('[PayPal Capture] ⚠️  Failed to refund unauthorized payment');
        }
      } catch (refundError) {
        console.error('[PayPal Capture] Error refunding unauthorized payment:', refundError);
      }

      return NextResponse.json(
        {
          error: 'Unauthorized: Order does not belong to this user',
          message: 'Payment has been refunded for security reasons',
        },
        { status: 403 }
      );
    }

    // Clean up custom_id from cache after successful decode (one-time use)
    if (customId) {
      await deleteCustomId(customId).catch((err) => {
        console.warn('[PayPal Capture] Failed to delete custom_id from cache:', err);
      });
    }

    // ✅ SECURITY FIX: Always require user identification - reject if cannot identify user
    const finalUserId = orderUserId || currentUserId;

    if (!finalUserId) {
      console.error('[PayPal Capture] ❌ Cannot identify user for payment - rejecting');

      // Attempt to refund since we cannot identify the user
      try {
        await fetch(`${baseUrl}/v2/payments/captures/${capture.id}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            note_to_payer: 'Refund due to user identification failure',
          }),
        });
      } catch (refundError) {
        console.error('[PayPal Capture] Failed to refund unidentified payment:', refundError);
      }

      return NextResponse.json(
        {
          error: 'Cannot identify user for this payment',
          message: 'Payment has been refunded',
        },
        { status: 400 }
      );
    }

    // Handle wallet recharge
    if (walletUserId) {
      try {
        const adminClient = await createAdminClient();
        const walletService = new WalletService(adminClient);
        const result = await walletService.recordRecharge({
          userId: walletUserId,
          amountCents,
          gateway: 'paypal',
          gatewayRef,
          currency: capture.amount.currency_code || 'USD',
          metadata: {
            paypal_capture: captureData,
          },
        });

        return NextResponse.json({
          success: true,
          captureId: capture.id,
          status: captureData.status,
          recharge: true,
          alreadyProcessed: (result as any)?.alreadyProcessed ?? false,
        });
      } catch (walletError) {
        console.error('[PayPal Capture] Failed to record wallet recharge:', walletError);
        return NextResponse.json(
          { error: 'Wallet recharge failed' },
          { status: 500 },
        );
      }
    }

    // Apply phase reward discount if present
    if (userId && rewardType && discountCents && discountCents > 0) {
      if (rewardType === 'free_product' || rewardType === 'store_credit') {
        try {
          const { PhaseRewardsService } = await import('@/lib/services/phase-rewards-service');
          const result = await PhaseRewardsService.applyReward(
            userId,
            discountCents,
            rewardType as 'free_product' | 'store_credit'
          );

          if (!result.success) {
            console.error('[PayPal Capture] Failed to apply phase reward:', result.error);
          }
        } catch (rewardError) {
          console.error('[PayPal Capture] Error applying phase reward:', rewardError);
        }
      }
    }

    // Create order if cart items are present in metadata
    if (requestMetadata && 'cartItems' in requestMetadata && Array.isArray(requestMetadata.cartItems) && requestMetadata.cartItems.length > 0) {
      try {
        const adminClient = await createAdminClient();
        const orderService = new OrderCreationService(adminClient);

        // Check if order already exists for this transaction
        const orderExists = await orderService.orderExistsForTransaction(gatewayRef);

        if (!orderExists) {
          const orderResult = await orderService.createOrderFromPayment({
            userId: finalUserId,
            totalCents: amountCents,
            currency: capture.amount.currency_code || 'USD',
            gateway: 'paypal',
            gatewayTransactionId: gatewayRef,
            metadata: requestMetadata,
            cartItems: requestMetadata.cartItems as any[],
            discountCents: discountCents || 0,
          });

          console.log('[PayPal Capture] Order created:', orderResult.orderId, {
            commissionsCreated: orderResult.commissionsCreated,
            affiliateId: orderResult.affiliateId,
          });

          // Send payment confirmation email
          try {
            const notificationService = new OrderNotificationService(adminClient);
            const userInfo = await notificationService.getUserInfo(finalUserId);

            if (userInfo) {
              const items = (requestMetadata.cartItems as any[]).map(item => ({
                name: item.productName || item.name || 'Product',
                quantity: item.quantity || 1,
                priceCents: item.priceCents || 0,
              }));

              await notificationService.sendPaymentConfirmationEmail({
                orderId: orderResult.orderId,
                userEmail: userInfo.email,
                userName: userInfo.name || 'Customer',
                totalCents: amountCents,
                currency: capture.amount.currency_code || 'USD',
                items,
                gateway: 'paypal',
                locale: requestMetadata.locale as string | undefined,
              });

              console.log('[PayPal Capture] Payment confirmation email sent to:', userInfo.email);
            }
          } catch (emailError) {
            console.error('[PayPal Capture] Failed to send payment confirmation email:', emailError);
            // Don't fail the payment processing if email fails
          }
        } else {
          console.log('[PayPal Capture] Order already exists for transaction:', gatewayRef);
        }
      } catch (orderError) {
        console.error('[PayPal Capture] Failed to create order:', orderError);
        // Don't fail the payment processing if order creation fails
      }
    }

    // Process subscription/payment
    const lifecycleService = createSubscriptionLifecycleService();
    const periodEndDate = new Date();
    periodEndDate.setMonth(periodEndDate.getMonth() + 1);
    const periodEnd = periodEndDate.toISOString();

    try {
      const result = await lifecycleService.handleConfirmedPayment({
        userId: finalUserId,
        amountCents,
        gatewayRef,
        periodEnd,
        gateway: 'paypal',
      });

      return NextResponse.json({
        success: true,
        captureId: capture.id,
        status: captureData.status,
        alreadyProcessed: result.alreadyProcessed,
      });
    } catch (error) {
      console.error('[PayPal Capture] Payment processing failed:', error);
      return NextResponse.json(
        { error: 'Payment processing failed' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[PayPal Capture] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to capture PayPal order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

