import { NextResponse } from 'next/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { z } from 'zod';
import { PaymentError } from '@/modules/payments/utils/payment-errors';
import { PaymentReturnUrlService } from '@/modules/payments/services/payment-return-url-service';
import { PAYMENT_API_TIMEOUT_MS } from '@/modules/payments/utils/payment-gateway-helpers';
import { validatePayment } from '@/lib/security/payment-validation';
import { PaymentRiskService } from '@/lib/services/payment-risk-service';
import { createClient } from '@/lib/supabase/server';
import { getClientIP } from '@/lib/security/ip-utils';
import { getCountryFromIP } from '@/lib/security/geo-utils';

const CreateCheckoutSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .int('Amount must be an integer')
    .min(50, 'Minimum amount is $0.50 (50 cents)')
    .max(10000000, 'Maximum amount is $100,000 (10,000,000 cents)'), // Amount in cents
  currency: z.string().default('usd'),
  description: z.string(),
  isTest: z.boolean().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  originUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }
    const body = await request.json();
    const { amount, currency, description, isTest, successUrl, cancelUrl, originUrl, metadata } = CreateCheckoutSchema.parse(body);

    // Get user ID from auth (if authenticated)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Get IP address and geolocation for risk assessment
    const ipAddress = getClientIP(request);
    const geoData = await getCountryFromIP(ipAddress);

    // ✅ SECURITY: Validate payment amount and sanitize metadata
    const intent = (metadata?.intent as string) || 'checkout';
    const paymentValidation = await validatePayment({
      amountCents: amount,
      currency,
      intent,
      metadata,
    });

    if (!paymentValidation.valid) {
      console.error('[Stripe Checkout] Payment validation failed:', paymentValidation.error);
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
    const validatedAmount = paymentValidation.serverAmountCents || amount;

    // ✅ 3D SECURE: Assess payment risk to determine if 3DS is required
    const riskAssessment = await PaymentRiskService.assessRisk({
      userId,
      amountCents: validatedAmount,
      currency,
      ipAddress,
      countryCode: geoData.countryCode,
      paymentMethod: 'card',
    });

    console.log('[Stripe Checkout] Risk assessment:', {
      userId,
      amountCents: validatedAmount,
      riskScore: riskAssessment.riskScore,
      riskLevel: riskAssessment.riskLevel,
      requiresStrongAuth: riskAssessment.requiresStrongAuth,
      factorsCount: riskAssessment.riskFactors.length,
    });

    const { fetchGatewayCredentials, isErrorResponse } = await import('@/modules/payments/utils/payment-gateway-helpers');
    const credentialsResult = await fetchGatewayCredentials<{ secret_key: string; publishable_key?: string }>('stripe', isTest);
    
    if (isErrorResponse(credentialsResult)) {
      return credentialsResult;
    }

    const { credentials } = credentialsResult;
    const secretKey = credentials.secret_key;

    // Create Stripe checkout session
    const checkoutResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(PAYMENT_API_TIMEOUT_MS),
      body: (() => {
        // Generate return URLs using the new service
        let finalSuccessUrl: string;
        let finalCancelUrl: string;

        if (successUrl && cancelUrl) {
          // Use provided URLs directly
          finalSuccessUrl = successUrl;
          finalCancelUrl = cancelUrl;
        } else {
          // Generate URLs with origin URL support
          const returnUrls = PaymentReturnUrlService.generateReturnUrls({
            provider: 'stripe',
            originUrl,
            metadata,
          });
          finalSuccessUrl = returnUrls.successUrl;
          finalCancelUrl = returnUrls.cancelUrl;
        }

        // ✅ 3D SECURE: Configure based on risk assessment
        // - 'any': Always require 3DS (high-risk transactions)
        // - 'automatic': Let Stripe decide based on their risk rules (medium-risk)
        // - Not set: No 3DS enforcement (low-risk)
        const threeDSecureMode = riskAssessment.requiresStrongAuth ? 'any' : 'automatic';

        const params = new URLSearchParams({
          'payment_method_types[0]': 'card',
          'line_items[0][price_data][currency]': currency,
          'line_items[0][price_data][product_data][name]': description,
          'line_items[0][price_data][unit_amount]': validatedAmount.toString(), // ✅ Use server-validated amount
          'line_items[0][quantity]': '1',
          mode: 'payment',
          success_url: finalSuccessUrl,
          cancel_url: finalCancelUrl,
          // ✅ 3D SECURE: Dynamic configuration based on risk
          'payment_method_options[card][request_three_d_secure]': threeDSecureMode,
        });

        console.log('[Stripe Checkout] 3D Secure configuration:', {
          mode: threeDSecureMode,
          riskLevel: riskAssessment.riskLevel,
          requiresStrongAuth: riskAssessment.requiresStrongAuth,
        });

        // ✅ SECURITY: Use sanitized metadata only
        if (sanitizedMetadata && typeof sanitizedMetadata === 'object') {
          Object.entries(sanitizedMetadata).forEach(([key, value]) => {
            if (value === undefined || value === null) {
              return;
            }

            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            params.append(`metadata[${key}]`, stringValue);

            if (key === 'userId' && typeof value === 'string') {
              params.set('client_reference_id', value);
            }
          });
        }

        return params;
      })(),
    });

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text();
      if (process.env.NODE_ENV !== 'production') {
        console.error('Stripe API error:', errorText);
      }
      throw new Error('Failed to create Stripe checkout session');
    }

    const checkoutData = await checkoutResponse.json();

    return NextResponse.json({
      sessionId: checkoutData.id,
      url: checkoutData.url,
      status: checkoutData.status,
    });
  } catch (error) {
    console.error('Stripe create checkout error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.flatten() },
        { status: 400 },
      );
    }

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to create Stripe checkout session' },
      { status: 500 },
    );
  }
}
