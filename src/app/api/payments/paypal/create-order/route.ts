import { NextResponse } from 'next/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { z } from 'zod';
import { PaymentError } from '@/modules/payments/utils/payment-errors';
import { PaymentReturnUrlService } from '@/modules/payments/services/payment-return-url-service';
import { PAYMENT_API_TIMEOUT_MS } from '@/modules/payments/utils/payment-gateway-helpers';
import { encodeCustomId as encodeSecureCustomId } from '@/lib/security/custom-id-encoder';
import { validatePayment } from '@/lib/security/payment-validation';
import { PaymentRiskService } from '@/lib/services/payment-risk-service';
import { getClientIP } from '@/lib/security/ip-utils';
import { getCountryFromIP } from '@/lib/security/geo-utils';

const CreateOrderSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .min(0.50, 'Minimum amount is $0.50')
    .max(100000, 'Maximum amount is $100,000'),
  currency: z.string().default('USD'),
  description: z.string(),
  isTest: z.boolean().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  originUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Generate a secure custom ID using HMAC-based encoding
 * This replaces the old insecure format with a cryptographically signed token
 */
const encodeCustomId = async (metadata?: Record<string, unknown> | null, userId?: string): Promise<string | undefined> => {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const intent = typeof metadata.intent === 'string' ? metadata.intent : null;
  const metaUserId = typeof metadata.userId === 'string' ? metadata.userId : userId;

  if (!metaUserId) {
    return undefined;
  }

  // Wallet recharge
  if (intent === 'wallet_recharge') {
    return await encodeSecureCustomId({
      userId: metaUserId,
      intent: 'wallet_recharge',
      metadata: {
        rechargeId: metadata.rechargeId,
      },
    });
  }

  // Checkout with phase rewards
  if ('phaseRewardType' in metadata && 'phaseRewardDiscountCents' in metadata) {
    return await encodeSecureCustomId({
      userId: metaUserId,
      intent: 'checkout',
      rewardType: metadata.phaseRewardType as string,
      discountCents: metadata.phaseRewardDiscountCents as number,
    });
  }

  // Subscription
  if (intent === 'subscription') {
    return await encodeSecureCustomId({
      userId: metaUserId,
      intent: 'subscription',
    });
  }

  return undefined;
};

export async function POST(request: Request) {
  try {
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }
    const body = await request.json();
    const { amount, currency, description, isTest, successUrl, cancelUrl, originUrl, metadata } = CreateOrderSchema.parse(body);

    // Get user ID from auth
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // ✅ SECURITY: Validate payment amount and sanitize metadata
    const intent = (metadata?.intent as string) || 'checkout';
    const amountCents = Math.round(amount * 100); // Convert to cents for validation

    const paymentValidation = await validatePayment({
      amountCents,
      currency,
      intent,
      metadata,
    });

    if (!paymentValidation.valid) {
      console.error('[PayPal Order] Payment validation failed:', paymentValidation.error);
      return NextResponse.json(
        {
          error: 'Payment validation failed',
          message: paymentValidation.error,
          serverAmountCents: paymentValidation.serverAmountCents,
        },
        { status: 400 }
      );
    }

    // Use sanitized metadata and server-validated amount
    const sanitizedMetadata = paymentValidation.sanitizedMetadata;
    const validatedAmountCents = paymentValidation.serverAmountCents || amountCents;
    const validatedAmount = validatedAmountCents / 100; // Convert back to dollars for PayPal

    // Get IP address and geolocation for risk assessment
    const ipAddress = getClientIP(request);
    const geoData = await getCountryFromIP(ipAddress);

    // ✅ 3D SECURE: Assess payment risk to determine if SCA is required
    const riskAssessment = await PaymentRiskService.assessRisk({
      userId,
      amountCents: validatedAmountCents,
      currency,
      ipAddress,
      countryCode: geoData.countryCode,
      paymentMethod: 'paypal',
    });

    console.log('[PayPal Order] Risk assessment:', {
      userId,
      amountCents: validatedAmountCents,
      riskScore: riskAssessment.riskScore,
      riskLevel: riskAssessment.riskLevel,
      requiresStrongAuth: riskAssessment.requiresStrongAuth,
      factorsCount: riskAssessment.riskFactors.length,
    });

    const { fetchGatewayCredentials, isErrorResponse } = await import('@/modules/payments/utils/payment-gateway-helpers');
    const credentialsResult = await fetchGatewayCredentials<{ client_id: string; client_secret: string }>('paypal', isTest);
    
    if (isErrorResponse(credentialsResult)) {
      return credentialsResult;
    }

    const { credentials } = credentialsResult;
    const baseUrl = credentials.client_id.includes('sandbox')
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    // Get access token
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(PAYMENT_API_TIMEOUT_MS),
    });

    if (!authResponse.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Generate secure custom ID with HMAC signature using sanitized metadata
    const customId = await encodeCustomId(sanitizedMetadata, userId);

    // Build return URLs using the new service
    let successReturnUrl: string;
    let cancelReturnUrl: string;

    if (successUrl && cancelUrl) {
      // Use provided URLs directly
      successReturnUrl = successUrl;
      cancelReturnUrl = cancelUrl;
    } else {
      // Generate URLs with origin URL support
      const returnUrls = PaymentReturnUrlService.generateReturnUrls({
        provider: 'paypal',
        originUrl,
        paymentId: customId,
        metadata,
      });
      successReturnUrl = returnUrls.successUrl;
      cancelReturnUrl = returnUrls.cancelUrl;
    }

    // ✅ 3D SECURE: Configure PayPal SCA (Strong Customer Authentication)
    // PayPal uses SCA_WHEN_REQUIRED by default, but we can force it for high-risk transactions
    const scaMode = riskAssessment.requiresStrongAuth ? 'SCA_ALWAYS' : 'SCA_WHEN_REQUIRED';

    console.log('[PayPal Order] SCA configuration:', {
      mode: scaMode,
      riskLevel: riskAssessment.riskLevel,
      requiresStrongAuth: riskAssessment.requiresStrongAuth,
    });

    // Create order
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(PAYMENT_API_TIMEOUT_MS),
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: validatedAmount.toFixed(2), // ✅ Use server-validated amount
          },
          description: description,
          ...(customId ? { custom_id: customId } : {}),
        }],
        // ✅ 3D SECURE: Configure SCA for card payments
        payment_source: {
          card: {
            verification_method: scaMode,
            experience_context: {
              return_url: successReturnUrl,
              cancel_url: cancelReturnUrl,
            },
          },
        },
        application_context: {
          return_url: successReturnUrl,
          cancel_url: cancelReturnUrl,
          user_action: 'PAY_NOW', // This ensures immediate payment
        },
      }),
    });

    if (!orderResponse.ok) {
      throw new Error('Failed to create PayPal order');
    }

    const orderData = await orderResponse.json();
    const approvalUrl = orderData.links?.find((link: { rel: string; href: string }) => link.rel === 'approve')?.href;

    return NextResponse.json({
      orderId: orderData.id,
      approvalUrl,
      status: orderData.status,
    });
  } catch (error) {
    console.error('PayPal create order error:', error);

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

    // Handle specific PayPal errors
    if (error instanceof Error && error.message.includes('PayPal')) {
      return NextResponse.json(
        { error: 'Payment service temporarily unavailable' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to create PayPal order' },
      { status: 500 },
    );
  }
}
