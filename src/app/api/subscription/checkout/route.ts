import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import {
  GatewayCredentialsService,
  type GatewayCredentialEnvironment,
  type GatewayCredentialRequestEnvironment,
} from '@/modules/payments/services/gateway-credentials-service';
import { PaymentError } from '@/modules/payments/utils/payment-errors';
import { PaymentReturnUrlService } from '@/modules/payments/services/payment-return-url-service';
import { getPlans } from '@/lib/services/plan-service';
import { EnvironmentConfigurationError, getAppUrl } from '@/lib/env';
import { createSubscriptionLifecycleService } from '@/modules/multilevel/factories/subscription-service-factory';
import { createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { NetworkCapacityService, NetworkCapacityError } from '@/modules/multilevel/services/network-capacity-service';
import type { PayPalCredentials, StripeCredentials } from '@/modules/payments/types/payment-types';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

// ✅ SECURITY FIX: Removed userId from schema - NEVER trust client for user identification
const CheckoutRequestSchema = z.object({
  locale: z.string().min(1).default('en'),
  planId: z.string().min(1),
  provider: z.enum(['stripe', 'paypal', 'wallet']).default('stripe'),
  providerMode: z.enum(['production', 'test']).optional(),
  originUrl: z.string().url().optional(),
  updatePaymentMethod: z.boolean().default(false), // Flag to indicate payment method update
});

const createStripeSession = async (params: {
  amountCents: number;
  planName: string;
  planDescription: string;
  locale: string;
  userId: string;
  planId: string;
  environment: GatewayCredentialEnvironment;
  credentials: StripeCredentials;
  originUrl?: string;
  discountRate?: number;
  userPhase?: number;
  updatePaymentMethod?: boolean;
}) => {
  const stripe = new Stripe(params.credentials.secret_key, { apiVersion: '2023-10-16' });

  // Generate return URLs using the new service
  let successUrl: string;
  let cancelUrl: string;

  const intent = params.updatePaymentMethod ? 'payment_method_update' : 'subscription_activation';

  if (params.originUrl) {
    const returnUrls = PaymentReturnUrlService.generateReturnUrls({
      provider: 'stripe',
      originUrl: params.originUrl,
      paymentId: `subscription:${params.userId}:${params.planId}`,
      metadata: {
        userId: params.userId,
        planId: params.planId,
        intent,
        environment: params.environment,
        locale: params.locale,
      },
    });
    successUrl = returnUrls.successUrl;
    cancelUrl = returnUrls.cancelUrl;
  } else {
    // Fallback to original URLs
    const baseUrl = getAppUrl();
    const statusParam = params.updatePaymentMethod ? 'payment_method_updated' : 'success';
    successUrl = `${baseUrl}/${params.locale}/subscription?status=${statusParam}&plan=${params.planId}`;
    cancelUrl = `${baseUrl}/${params.locale}/subscription?status=cancelled`;
  }

  const metadata: Record<string, string> = {
    userId: params.userId,
    planId: params.planId,
    intent,
    environment: params.environment,
    locale: params.locale,
  };

  // Add discount metadata if applicable
  if (params.discountRate && params.discountRate > 0) {
    metadata.subscriptionDiscountRate = params.discountRate.toString();
    metadata.userPhase = (params.userPhase ?? 0).toString();
  }

  // If updating payment method, use setup mode instead of subscription mode
  if (params.updatePaymentMethod) {
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      metadata,
      client_reference_id: params.userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { url: session.url, sessionId: session.id };
  }

  // Regular subscription mode for new subscriptions
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: params.planName,
            description: params.planDescription,
          },
          unit_amount: params.amountCents,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ],
    metadata,
    client_reference_id: params.userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url, sessionId: session.id };
};

const createPayPalOrder = async (params: {
  amountCents: number;
  locale: string;
  userId: string;
  planId: string;
  planDescription: string;
  environment: GatewayCredentialEnvironment;
  credentials: PayPalCredentials;
  originUrl?: string;
  discountRate?: number;
  userPhase?: number;
}) => {
  const baseUrl = params.environment === 'test' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${params.credentials.client_id}:${params.credentials.client_secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!authResponse.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const authData = await authResponse.json();
  const accessToken = authData.access_token as string;

  // Generate return URLs using the new service
  let successUrl: string;
  let cancelUrl: string;

  if (params.originUrl) {
    const returnUrls = PaymentReturnUrlService.generateReturnUrls({
      provider: 'paypal',
      originUrl: params.originUrl,
      paymentId: `subscription:${params.userId}:${params.planId}`,
      metadata: {
        userId: params.userId,
        planId: params.planId,
        intent: 'subscription_activation',
        environment: params.environment,
        locale: params.locale,
      },
    });
    successUrl = returnUrls.successUrl;
    cancelUrl = returnUrls.cancelUrl;
  } else {
    // Fallback to original URLs
    const appUrl = getAppUrl();
    successUrl = `${appUrl}/${params.locale}/subscription?status=success&plan=${params.planId}`;
    cancelUrl = `${appUrl}/${params.locale}/subscription?status=cancelled`;
  }

  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: (params.amountCents / 100).toFixed(2),
          },
          description: params.planDescription,
          custom_id: `subscription:${params.userId}:${params.planId}`.slice(0, 127),
        },
      ],
      application_context: {
        return_url: successUrl,
        cancel_url: cancelUrl,
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!orderResponse.ok) {
    throw new Error('Failed to create PayPal order');
  }

  const orderData = await orderResponse.json();
  type PayPalLink = { rel: string; href?: string };
  const approvalUrl = (orderData.links as PayPalLink[] | undefined)?.find((link) => link.rel === 'approve')?.href ?? null;

  return { approvalUrl, orderId: orderData.id };
};

const processWalletPayment = async (params: { amountCents: number; userId: string; planId: string }) => {
  console.log(`[SubscriptionCheckout] Processing wallet payment for user ${params.userId}, amount: ${params.amountCents} cents, plan: ${params.planId}`);

  const adminClient = await createAdminClient();
  const walletService = new WalletService(adminClient);

  try {
    await walletService.spendFunds(params.userId, params.amountCents, {
      intent: 'subscription_activation',
      planId: params.planId,
      provider: 'wallet',
    });
    console.log(`[SubscriptionCheckout] Wallet spend successful for user ${params.userId}`);
  } catch (error) {
    console.error(`[SubscriptionCheckout] Wallet spend failed for user ${params.userId}:`, error);
    throw error;
  }

  const lifecycleService = createSubscriptionLifecycleService();
  const gatewayRef = `wallet:${params.userId}:${randomUUID()}`;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`[SubscriptionCheckout] Activating subscription for user ${params.userId}, gatewayRef: ${gatewayRef}`);

  try {
    const _result = await lifecycleService.handleConfirmedPayment({
      userId: params.userId,
      planId: params.planId,
      amountCents: params.amountCents,
      gatewayRef,
      periodEnd,
      gateway: 'wallet',
    });
    console.log(`[SubscriptionCheckout] Subscription activation completed for user ${params.userId}`);
    return {};
  } catch (error) {
    console.error(`[SubscriptionCheckout] Subscription activation failed for user ${params.userId}:`, error);
    throw error;
  }
};

const resolveProviderCredentials = async <T extends 'stripe' | 'paypal'>(
  provider: T,
  mode?: 'production' | 'test',
) => {
  const preferred: GatewayCredentialRequestEnvironment = mode === 'test' ? 'test' : mode === 'production' ? 'live' : 'auto';

  try {
    return await GatewayCredentialsService.getActiveProviderCredentials(provider, preferred);
  } catch (error) {
    if (preferred !== 'auto') {
      return GatewayCredentialsService.getActiveProviderCredentials(provider, 'auto');
    }

    throw error;
  }
};

/**
 * Get user's current phase and calculate subscription discount
 * Returns the discounted amount in cents and discount metadata
 */
const calculateSubscriptionDiscount = async (
  userId: string,
  originalAmountCents: number
): Promise<{
  finalAmountCents: number;
  discountRate: number;
  discountAmountCents: number;
  userPhase: number;
}> => {
  try {
    const adminClient = await createAdminClient();

    // Get user's current phase
    const { data: phaseData, error: phaseError } = await adminClient
      .from('phases')
      .select('phase')
      .eq('user_id', userId)
      .maybeSingle();

    if (phaseError) {
      console.error('[SubscriptionCheckout] Error fetching user phase:', phaseError);
      return {
        finalAmountCents: originalAmountCents,
        discountRate: 0,
        discountAmountCents: 0,
        userPhase: 0,
      };
    }

    const userPhase = phaseData?.phase ?? 0;

    return {
      finalAmountCents: originalAmountCents,
      discountRate: 0,
      discountAmountCents: 0,
      userPhase,
    };
  } catch (error) {
    console.error('[SubscriptionCheckout] Error calculating subscription discount:', error);
    return {
      finalAmountCents: originalAmountCents,
      discountRate: 0,
      discountAmountCents: 0,
      userPhase: 0,
    };
  }
};

// GET endpoint to list available plans for subscription
export async function GET() {
  try {
    const plans = await getPlans();

    const subscriptionPlans = plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name_en || plan.name || 'Plan',
      description: plan.description_en || plan.description || '',
      price: plan.price,
      features: plan.features_en || plan.features || [],
      isActive: plan.is_active,
      isDefault: plan.is_default,
    }));

    return NextResponse.json(subscriptionPlans);
  } catch (error) {
    console.error('Failed to fetch available plans', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) return csrfError;

  // ✅ SECURITY: Authenticate user BEFORE processing request
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ✅ SECURITY: Use authenticated userId from token, NOT from request body
  const userId = user.id;

  let payload: z.infer<typeof CheckoutRequestSchema>;
  try {
    payload = CheckoutRequestSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const plans = await getPlans();
    const selectedPlan = plans.find((plan) => plan.id === payload.planId);

    if (!selectedPlan) {
      return NextResponse.json({ error: 'Plan not found or not available' }, { status: 404 });
    }

    const adminClient = await createAdminClient();

    // Check if user has an active subscription (for payment method update flow)
    const { SubscriptionRepository } = await import('@/modules/multilevel/repositories/subscription-repository');
    const subscriptionRepo = new SubscriptionRepository(adminClient);
    const existingSubscription = await subscriptionRepo.findByUserId(userId);
    const hasActiveSubscription = existingSubscription && 
      (existingSubscription.status === 'active' || existingSubscription.status === 'past_due');

    // If updatePaymentMethod flag is set or user has active subscription, treat as payment method update
    const isPaymentMethodUpdate = Boolean(payload.updatePaymentMethod || hasActiveSubscription);

    // Validate sponsor network capacity before allowing NEW subscriptions (skip for payment method updates)
    if (!isPaymentMethodUpdate) {
      const capacityService = new NetworkCapacityService(adminClient);

      try {
        await capacityService.validateSponsorCapacity(userId);
      } catch (error) {
        if (error instanceof NetworkCapacityError) {
          console.warn(
            `[SubscriptionCheckout] Sponsor capacity limit reached for user ${userId}: ` +
            `sponsor=${error.sponsorId}, current=${error.currentCount}, max=${error.maxAllowed}`
          );
          return NextResponse.json(
            {
              error: error.message,
              code: error.code,
              sponsorId: error.sponsorId,
              currentCount: error.currentCount,
              maxAllowed: error.maxAllowed,
            },
            { status: 422 }
          );
        }
        // If it's another type of error, log it and continue (don't block subscription)
        console.error('[SubscriptionCheckout] Error checking sponsor capacity:', error);
      }
    }

    // Calculate original amount
    const originalAmountCents = Math.round(selectedPlan.price * 100);

    // Calculate subscription discount based on user's phase
    const discountInfo = await calculateSubscriptionDiscount(userId, originalAmountCents);
    const amountCents = discountInfo.finalAmountCents;

    // Log discount application
    if (discountInfo.discountAmountCents > 0) {
      console.log(
        `[SubscriptionCheckout] Subscription discount applied for user ${userId}: ` +
        `Phase ${discountInfo.userPhase}, Rate ${(discountInfo.discountRate * 100).toFixed(1)}%, ` +
        `Original $${(originalAmountCents / 100).toFixed(2)}, ` +
        `Discount $${(discountInfo.discountAmountCents / 100).toFixed(2)}, ` +
        `Final $${(amountCents / 100).toFixed(2)}`
      );
    }

    switch (payload.provider) {
      case 'stripe': {
        const { credentials, requestedEnvironment } = await resolveProviderCredentials('stripe', payload.providerMode);
        const _result = await createStripeSession({
          amountCents,
          planDescription:
            selectedPlan.description_en || selectedPlan.description || 'Monthly subscription',
          planName: selectedPlan.name_en || selectedPlan.name || 'Subscription Plan',
          locale: payload.locale,
          userId: userId,
          planId: selectedPlan.id,
          environment: requestedEnvironment,
          credentials,
          originUrl: payload.originUrl,
          discountRate: discountInfo.discountRate,
          userPhase: discountInfo.userPhase,
          updatePaymentMethod: isPaymentMethodUpdate,
        });

        return NextResponse.json({
          url: _result.url,
          sessionId: _result.sessionId,
          plan: selectedPlan,
          discount: discountInfo.discountAmountCents > 0 ? {
            originalAmountCents,
            discountAmountCents: discountInfo.discountAmountCents,
            finalAmountCents: amountCents,
            discountRate: discountInfo.discountRate,
            userPhase: discountInfo.userPhase,
          } : undefined,
        });
      }
      case 'paypal': {
        const { credentials, requestedEnvironment } = await resolveProviderCredentials('paypal', payload.providerMode);
        const _result = await createPayPalOrder({
          amountCents,
          locale: payload.locale,
          userId: userId,
          planId: selectedPlan.id,
          planDescription:
            selectedPlan.description_en || selectedPlan.description || 'Monthly subscription',
          environment: requestedEnvironment,
          credentials,
          originUrl: payload.originUrl,
          discountRate: discountInfo.discountRate,
          userPhase: discountInfo.userPhase,
        });

        return NextResponse.json({
          url: _result.approvalUrl,
          orderId: _result.orderId,
          plan: selectedPlan,
          discount: discountInfo.discountAmountCents > 0 ? {
            originalAmountCents,
            discountAmountCents: discountInfo.discountAmountCents,
            finalAmountCents: amountCents,
            discountRate: discountInfo.discountRate,
            userPhase: discountInfo.userPhase,
          } : undefined,
        });
      }
      case 'wallet': {
        const _result = await processWalletPayment({
          amountCents,
          userId: userId,
          planId: selectedPlan.id,
        });

        return NextResponse.json({
          status: 'wallet_confirmed',
          discount: discountInfo.discountAmountCents > 0 ? {
            originalAmountCents,
            discountAmountCents: discountInfo.discountAmountCents,
            finalAmountCents: amountCents,
            discountRate: discountInfo.discountRate,
            userPhase: discountInfo.userPhase,
          } : undefined,
        });
      }
      default: {
        return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
      }
    }
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      console.error('Missing environment configuration for subscription checkout', error);
      return NextResponse.json(
        {
          error: 'environment-configuration-missing',
          message: error.message,
          missing: error.missingKeys,
        },
        { status: 503 },
      );
    }
    console.error('Failed to create subscription checkout session', error);

    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }

    if (error instanceof Error && error.message.includes('wallet')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
