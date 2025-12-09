import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { GatewayCredentialsService } from '@/modules/payments/services/gateway-credentials-service';
import { PaymentError, PaymentErrorCode } from '@/modules/payments/utils/payment-errors';
import { createSubscriptionLifecycleService } from '@/modules/multilevel/factories/subscription-service-factory';
import { createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { OrderCreationService } from '@/modules/orders/services/order-creation-service';
import { OrderNotificationService } from '@/modules/orders/services/order-notification-service';
import { rateLimit, RateLimitPresets, getRateLimitHeaders } from '@/lib/utils/rate-limit';
import { StripeFraudService } from '@/lib/services/stripe-fraud-service';

type StripeClient = InstanceType<typeof Stripe>;
type StripeEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;
type StripeInvoicePayload = {
  object: 'invoice';
  id?: string;
  amount_paid?: number | null;
  lines?: {
    data?: Array<{
      period?: { end?: number | null } | null;
    }>;
  };
  metadata?: Record<string, unknown> | null;
};
type StripeCheckoutSessionPayload = {
  object: 'checkout.session';
  id?: string;
  amount_total?: number | null;
  client_reference_id?: string | null;
  period_end?: number | null;
  metadata?: Record<string, unknown> | null;
};
type StripePayload =
  | StripeInvoicePayload
  | StripeCheckoutSessionPayload
  | (Record<string, unknown> & { object?: string })
  | null;

const isInvoice = (payload: StripePayload): payload is StripeInvoicePayload => {
  return Boolean(payload && payload.object === 'invoice');
};

const isCheckoutSession = (payload: StripePayload): payload is StripeCheckoutSessionPayload => {
  return Boolean(payload && payload.object === 'checkout.session');
};

let stripeResourcesPromise: Promise<{ stripe: StripeClient; webhookSecret: string }> | null = null;

const getStripeResources = async () => {
  if (!stripeResourcesPromise) {
    stripeResourcesPromise = GatewayCredentialsService.getActiveProviderCredentialsWithFallback('stripe').then(
      ({ credentials }) => {
        if (!credentials.webhook_secret) {
          throw new PaymentError(
            'Stripe webhook secret is not configured. Set it from the admin payment settings.',
            'stripe',
            PaymentErrorCode.CONFIGURATION_MISSING,
            { provider: 'stripe', timestamp: new Date() },
          );
        }

        return {
          stripe: new Stripe(credentials.secret_key, { apiVersion: '2024-12-18' }),
          webhookSecret: credentials.webhook_secret,
        };
      },
    );
  }

  return stripeResourcesPromise;
};

export async function POST(req: NextRequest) {
  // ✅ SECURITY: Rate limiting for webhooks (200 req/min)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'stripe-webhook';

  const rateLimitResult = await rateLimit(ip, RateLimitPresets.webhook);

  if (!rateLimitResult.success) {
    console.warn(`[Stripe Webhook] Rate limit exceeded for IP: ${ip}`);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const body = await req.text();

  let event: StripeEvent;
  try {
    const { stripe, webhookSecret } = await getStripeResources();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    if (err instanceof PaymentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }

    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  // Protection against replay attacks - verify event timestamp
  const EVENT_MAX_AGE_SECONDS = 300; // 5 minutes
  const eventAge = Date.now() / 1000 - (event.created as number);

  if (eventAge > EVENT_MAX_AGE_SECONDS) {
    console.error(`[Stripe Webhook] Event ${event.id} is too old (${Math.floor(eventAge)}s > ${EVENT_MAX_AGE_SECONDS}s) - possible replay attack`);
    return NextResponse.json({ error: 'Event too old' }, { status: 400 });
  }

  // Check for duplicate event processing (idempotency)
  const adminClient = await createAdminClient();
  const { data: existingEvent } = await adminClient
    .from('webhook_events')
    .select('id, created_at')
    .eq('event_id', event.id)
    .eq('provider', 'stripe')
    .single();

  if (existingEvent) {
    console.log(`[Stripe Webhook] Event ${event.id} already processed at ${existingEvent.created_at}, skipping`);
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Record event to prevent duplicate processing
  await adminClient
    .from('webhook_events')
    .insert({
      event_id: event.id,
      provider: 'stripe',
      event_type: event.type,
      processed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (event.type === 'invoice.payment_failed') {
    const payload = (event.data?.object ?? null) as StripePayload;
    const metadata =
      (isInvoice(payload) || isCheckoutSession(payload)) && payload.metadata && typeof payload.metadata === 'object'
        ? payload.metadata
        : null;
    const checkoutReference = isCheckoutSession(payload) ? payload.client_reference_id ?? undefined : undefined;
    const userId =
      metadata && 'userId' in metadata
        ? (metadata.userId as string | undefined)
        : checkoutReference ?? undefined;

    if (!userId) {
      return NextResponse.json({ ok: true, ignored: 'missing-user' });
    }

    const locale = metadata && 'locale' in metadata && typeof metadata.locale === 'string' ? metadata.locale : null;

    const lifecycleService = createSubscriptionLifecycleService();

    try {
      const result = await lifecycleService.cancelSubscription({
        userId,
        reason: 'payment_failure',
        locale,
      });

      return NextResponse.json({ ok: true, canceled: result.canceled, alreadyCanceled: result.alreadyCanceled });
    } catch (error) {
      console.error('Stripe cancellation after payment failure failed', error);
      return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 });
    }
  }

  if (event.type === 'invoice.payment_succeeded' || event.type === 'checkout.session.completed') {
    const payload = (event.data?.object ?? null) as StripePayload;

    const metadata =
      (isInvoice(payload) || isCheckoutSession(payload)) && payload.metadata && typeof payload.metadata === 'object'
        ? payload.metadata
        : null;
    const checkoutReference = isCheckoutSession(payload) ? payload.client_reference_id ?? undefined : undefined;
    const userId =
      metadata && 'userId' in metadata
        ? (metadata.userId as string | undefined)
        : checkoutReference ?? undefined;
    if (!userId) {
      return NextResponse.json({ ok: true, ignored: 'missing-user' });
    }

    const amountCents =
      isInvoice(payload)
        ? payload.amount_paid ?? 0
        : isCheckoutSession(payload)
          ? payload.amount_total ?? 0
          : 0;
    const gatewayRef =
      payload && typeof payload === 'object' && typeof payload.id === 'string'
        ? payload.id
        : typeof event.id === 'string'
          ? event.id
          : 'stripe-event';
    const periodSeconds =
      isInvoice(payload) && payload.lines?.data?.[0]?.period?.end
        ? payload.lines.data[0]?.period?.end ?? null
        : isCheckoutSession(payload)
          ? payload.period_end ?? null
          : null;
    const periodEnd = periodSeconds ? new Date(periodSeconds * 1000).toISOString() : null;

    const intent =
      metadata && 'intent' in metadata && typeof metadata.intent === 'string' ? metadata.intent : null;

    if (intent === 'wallet_recharge') {
      try {
        const adminClient = await createAdminClient();
        const walletService = new WalletService(adminClient);
        const result = await walletService.recordRecharge({
          userId,
          amountCents,
          gateway: 'stripe',
          gatewayRef,
          currency:
            metadata && 'currency' in metadata && typeof metadata.currency === 'string'
              ? (metadata.currency as string)
              : 'USD',
          metadata: {
            stripe_metadata: metadata,
          },
        });

        return NextResponse.json({ ok: true, recharge: true, alreadyProcessed: (result as any)?.alreadyProcessed ?? false });
      } catch (walletError) {
        console.error('Failed to record wallet recharge from Stripe webhook', walletError);
        return NextResponse.json({ error: 'Wallet recharge failed' }, { status: 500 });
      }
    }

    // Apply phase reward discount if present in metadata
    if (metadata && 'phaseRewardType' in metadata && 'phaseRewardDiscountCents' in metadata) {
      const rewardType = metadata.phaseRewardType as string;
      const discountCents = metadata.phaseRewardDiscountCents as number;

      if ((rewardType === 'free_product' || rewardType === 'store_credit') && typeof discountCents === 'number' && discountCents > 0) {
        try {
          // Import PhaseRewardsService directly to avoid HTTP call
          const { PhaseRewardsService } = await import('@/lib/services/phase-rewards-service');
          const result = await PhaseRewardsService.applyReward(userId, discountCents, rewardType as 'free_product' | 'store_credit');

          if (!result.success) {
            console.error('[Stripe Webhook] Failed to apply phase reward:', result.error);
          }
        } catch (rewardError) {
          console.error('[Stripe Webhook] Error applying phase reward:', rewardError);
        }
      }
    }

    // Create order if cart items are present in metadata
    if (metadata && 'cartItems' in metadata && Array.isArray(metadata.cartItems) && metadata.cartItems.length > 0) {
      try {
        const adminClient = await createAdminClient();
        const orderService = new OrderCreationService(adminClient);

        // Check if order already exists for this transaction
        const orderExists = await orderService.orderExistsForTransaction(gatewayRef);

        if (!orderExists) {
          const discountCents = metadata.phaseRewardDiscountCents as number | undefined;
          const orderResult = await orderService.createOrderFromPayment({
            userId,
            totalCents: amountCents,
            currency: metadata.currency as string | undefined || 'USD',
            gateway: 'stripe',
            gatewayTransactionId: gatewayRef,
            metadata,
            cartItems: metadata.cartItems as any[],
            discountCents: discountCents || 0,
          });

          console.log('[Stripe Webhook] Order created:', orderResult.orderId, {
            commissionsCreated: orderResult.commissionsCreated,
            affiliateId: orderResult.affiliateId,
          });

          // Send payment confirmation email
          try {
            const notificationService = new OrderNotificationService(adminClient);
            const userInfo = await notificationService.getUserInfo(userId);

            if (userInfo) {
              const items = (metadata.cartItems as any[]).map(item => ({
                name: item.productName || item.name || 'Product',
                quantity: item.quantity || 1,
                priceCents: item.priceCents || 0,
              }));

              await notificationService.sendPaymentConfirmationEmail({
                orderId: orderResult.orderId,
                userEmail: userInfo.email,
                userName: userInfo.name || 'Customer',
                totalCents: amountCents,
                currency: metadata.currency as string | undefined || 'USD',
                items,
                gateway: 'stripe',
                locale: metadata.locale as string | undefined,
              });

              console.log('[Stripe Webhook] Payment confirmation email sent to:', userInfo.email);
            }
          } catch (emailError) {
            console.error('[Stripe Webhook] Failed to send payment confirmation email:', emailError);
            // Don't fail the webhook processing if email fails
          }
        } else {
          console.log('[Stripe Webhook] Order already exists for transaction:', gatewayRef);
        }
      } catch (orderError) {
        console.error('[Stripe Webhook] Failed to create order:', orderError);
        // Don't fail the webhook processing if order creation fails
      }
    }

    const lifecycleService = createSubscriptionLifecycleService();

    // Extract planId from metadata if available
    const planId = metadata && 'planId' in metadata ? (metadata.planId as string | undefined) : undefined;

    try {
      const result = await lifecycleService.handleConfirmedPayment({
        userId,
        planId,
        amountCents,
        gatewayRef,
        periodEnd,
        gateway: 'stripe',
      });

      return NextResponse.json({ ok: true, alreadyProcessed: result.alreadyProcessed });
    } catch (error) {
      console.error('Stripe webhook processing failed', error);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  // ============================================================================
  // STRIPE RADAR - FRAUD DETECTION EVENTS
  // ============================================================================

  // Disputa creada (chargeback)
  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.updated') {
    try {
      await StripeFraudService.processDispute(event as any);
      return NextResponse.json({ ok: true, fraudEventProcessed: true });
    } catch (error) {
      console.error('[Stripe Webhook] Failed to process dispute', error);
      return NextResponse.json({ ok: true, fraudEventFailed: true });
    }
  }

  // Advertencia temprana de fraude (Early Fraud Warning)
  if (event.type === 'radar.early_fraud_warning.created' || event.type === 'radar.early_fraud_warning.updated') {
    try {
      await StripeFraudService.processEarlyFraudWarning(event as any);
      return NextResponse.json({ ok: true, fraudEventProcessed: true });
    } catch (error) {
      console.error('[Stripe Webhook] Failed to process early fraud warning', error);
      return NextResponse.json({ ok: true, fraudEventFailed: true });
    }
  }

  // Revisión de Stripe Radar
  if (event.type === 'review.opened' || event.type === 'review.closed') {
    try {
      await StripeFraudService.processReview(event as any);
      return NextResponse.json({ ok: true, fraudEventProcessed: true });
    } catch (error) {
      console.error('[Stripe Webhook] Failed to process review', error);
      return NextResponse.json({ ok: true, fraudEventFailed: true });
    }
  }

  // Cargo fallido (puede indicar fraude)
  if (event.type === 'charge.failed') {
    try {
      await StripeFraudService.processFailedCharge(event as any);
      return NextResponse.json({ ok: true, fraudEventProcessed: true });
    } catch (error) {
      console.error('[Stripe Webhook] Failed to process failed charge', error);
      return NextResponse.json({ ok: true, fraudEventFailed: true });
    }
  }

  return NextResponse.json({ ok: true });
}
