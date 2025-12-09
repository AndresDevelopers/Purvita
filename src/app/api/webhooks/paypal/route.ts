import { NextRequest, NextResponse } from 'next/server';
import { createSubscriptionLifecycleService } from '@/modules/multilevel/factories/subscription-service-factory';
import { createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { GatewayCredentialsService } from '@/modules/payments/services/gateway-credentials-service';
import { PaymentError, PaymentErrorCode } from '@/modules/payments/utils/payment-errors';
import { rateLimit, RateLimitPresets, getRateLimitHeaders } from '@/lib/utils/rate-limit';

const SUPPORTED_EVENTS = new Set(['PAYMENT.SALE.COMPLETED', 'CHECKOUT.ORDER.APPROVED']);

/**
 * Verify PayPal webhook signature
 * https://developer.paypal.com/api/rest/webhooks/rest/#verify-webhook-signature
 */
async function verifyPayPalWebhook(
  webhookId: string,
  headers: Headers,
  body: string,
  credentials: { mode: string; clientId: string; secret: string }
): Promise<boolean> {
  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionTime = headers.get('paypal-transmission-time');
  const transmissionSig = headers.get('paypal-transmission-sig');
  const certUrl = headers.get('paypal-cert-url');
  const authAlgo = headers.get('paypal-auth-algo');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const apiBase = credentials.mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // Get PayPal OAuth token with timeout
  const authResponse = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000), // 15 second timeout
  });

  if (!authResponse.ok) {
    console.error('PayPal auth failed:', await authResponse.text());
    return false;
  }

  const authData = await authResponse.json();
  const accessToken = authData.access_token;

  // Verify webhook signature with timeout
  const verifyResponse = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
    signal: AbortSignal.timeout(15000), // 15 second timeout
  });

  if (!verifyResponse.ok) {
    console.error('PayPal signature verification failed:', await verifyResponse.text());
    return false;
  }

  const verifyData = await verifyResponse.json();
  return verifyData.verification_status === 'SUCCESS';
}

export async function POST(req: NextRequest) {
  // ✅ SECURITY: Rate limiting for webhooks (200 req/min)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'paypal-webhook';

  const rateLimitResult = await rateLimit(ip, RateLimitPresets.webhook);

  if (!rateLimitResult.success) {
    console.warn(`[PayPal Webhook] Rate limit exceeded for IP: ${ip}`);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }

  const body = await req.text();
  let payload: any;

  try {
    payload = JSON.parse(body);
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // ALWAYS verify webhook signature for security - CRITICAL
  // Signature verification is REQUIRED regardless of provider status
  try {
    const { credentials, record } = await GatewayCredentialsService.getProviderCredentials('paypal', 'auto');

    // Get webhook ID from environment or credentials
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || credentials.webhook_id;

    if (!webhookId) {
      console.error('❌ PAYPAL_WEBHOOK_ID not configured - REJECTING webhook');
      return NextResponse.json(
        {
          error: 'Webhook verification required',
          message: 'PAYPAL_WEBHOOK_ID must be configured for security. Configure in admin settings or environment variables.'
        },
        { status: 500 }
      );
    }

    if (!credentials.client_id || !credentials.client_secret) {
      console.error('❌ PayPal credentials are incomplete - REJECTING webhook');
      return NextResponse.json(
        { error: 'Incomplete PayPal credentials' },
        { status: 500 }
      );
    }

    // ALWAYS verify signature - this is a security requirement
    const isValid = await verifyPayPalWebhook(
      webhookId,
      req.headers,
      body,
      {
        mode: credentials.mode || 'sandbox',
        clientId: credentials.client_id,
        secret: credentials.client_secret,
      }
    );

    if (!isValid) {
      console.error('❌ PayPal webhook signature verification FAILED');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    console.log('✅ PayPal webhook signature verified successfully');

    // Now check if provider is active to process the webhook
    if (record.status !== 'active') {
      console.log('ℹ️ PayPal webhook verified but provider is not active, ignoring');
      return NextResponse.json({ ok: true, ignored: 'provider-inactive' });
    }
  } catch (error) {
    if (error instanceof PaymentError && error.code === PaymentErrorCode.CONFIGURATION_MISSING) {
      // PayPal is not configured at all - reject for security
      console.error('❌ PayPal webhook received but provider is not configured - REJECTING');
      return NextResponse.json(
        { error: 'PayPal not configured' },
        { status: 500 }
      );
    }

    console.error('PayPal webhook verification error:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Webhook verification failed' : (error as Error).message },
      { status: 500 }
    );
  }

  // Protection against replay attacks - verify event timestamp
  const EVENT_MAX_AGE_SECONDS = 300; // 5 minutes
  const eventTime = payload.create_time ? new Date(payload.create_time).getTime() / 1000 : null;

  if (eventTime) {
    const eventAge = Date.now() / 1000 - eventTime;
    if (eventAge > EVENT_MAX_AGE_SECONDS) {
      console.error(`[PayPal Webhook] Event ${payload.id} is too old (${Math.floor(eventAge)}s > ${EVENT_MAX_AGE_SECONDS}s) - possible replay attack`);
      return NextResponse.json({ error: 'Event too old' }, { status: 400 });
    }
  }

  if (!SUPPORTED_EVENTS.has(payload?.event_type)) {
    return NextResponse.json({ ok: true, ignored: 'event-type' });
  }

  const resource = payload.resource ?? {};
  const customId = typeof resource.custom_id === 'string' ? resource.custom_id : null;
  const walletMatch = customId?.startsWith('wallet_recharge:') ? customId.split(':') : null;
  const walletUserId = walletMatch && walletMatch.length >= 2 ? walletMatch[1] : null;
  const subscriptionMatch = customId?.startsWith('subscription:') ? customId.split(':') : null;
  const subscriptionUserId = subscriptionMatch && subscriptionMatch.length >= 2 ? subscriptionMatch[1] : null;
  const subscriptionPlanId = subscriptionMatch && subscriptionMatch.length >= 3 ? subscriptionMatch[2] : null;
  const checkoutMatch = customId?.startsWith('checkout:') ? customId.split(':') : null;
  const checkoutUserId = checkoutMatch && checkoutMatch.length >= 4 ? checkoutMatch[1] : null;
  const rewardType = checkoutMatch && checkoutMatch.length >= 4 ? checkoutMatch[2] : null;
  const discountCents = checkoutMatch && checkoutMatch.length >= 4 ? parseInt(checkoutMatch[3], 10) : null;
  
  const userId =
    walletUserId ||
    subscriptionUserId ||
    checkoutUserId ||
    customId ||
    resource.supplementary_data?.related_ids?.customer_user_id;
  if (!userId) {
    return NextResponse.json({ ok: true, ignored: 'missing-user' });
  }

  const amountValue = parseFloat(resource.amount?.value ?? '0');
  const amountCents = Number.isFinite(amountValue) ? Math.round(amountValue * 100) : 0;
  const gatewayRef = resource.id ?? payload.id;
  const periodEnd = resource.billing_info?.next_billing_time ?? null;

  if (!gatewayRef) {
    return NextResponse.json({ error: 'Missing gateway reference' }, { status: 400 });
  }

  if (walletUserId) {
    try {
      const adminClient = await createAdminClient();
      const walletService = new WalletService(adminClient);
      const result = await walletService.recordRecharge({
        userId: walletUserId,
        amountCents,
        gateway: 'paypal',
        gatewayRef,
        currency:
          typeof resource.amount?.currency_code === 'string' ? resource.amount.currency_code : 'USD',
        metadata: {
          paypal_resource: resource,
        },
      });

      return NextResponse.json({ ok: true, recharge: true, alreadyProcessed: (result as any)?.alreadyProcessed ?? false });
    } catch (walletError) {
      console.error('Failed to record wallet recharge from PayPal webhook', walletError);
      return NextResponse.json({ error: 'Wallet recharge failed' }, { status: 500 });
    }
  }

  // Apply phase reward discount if present in custom_id
  if (checkoutUserId && rewardType && discountCents && discountCents > 0) {
    if (rewardType === 'free_product' || rewardType === 'store_credit') {
      try {
        // Import PhaseRewardsService directly to avoid HTTP call
        const { PhaseRewardsService } = await import('@/lib/services/phase-rewards-service');
        const result = await PhaseRewardsService.applyReward(checkoutUserId, discountCents, rewardType as 'free_product' | 'store_credit');

        if (!result.success) {
          console.error('[PayPal Webhook] Failed to apply phase reward:', result.error);
        }
      } catch (rewardError) {
        console.error('[PayPal Webhook] Error applying phase reward:', rewardError);
      }
    }
  }

  // Note: PayPal webhooks don't include full metadata like Stripe does
  // Order creation for PayPal will be handled in the capture-order endpoint
  // where we have access to the full metadata from the session

  const lifecycleService = createSubscriptionLifecycleService();

  try {
    const result = await lifecycleService.handleConfirmedPayment({
      userId,
      planId: subscriptionPlanId,
      amountCents,
      gatewayRef,
      periodEnd,
      gateway: 'paypal',
    });

    return NextResponse.json({ ok: true, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    console.error('PayPal webhook processing failed', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
