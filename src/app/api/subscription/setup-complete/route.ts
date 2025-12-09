import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { GatewayCredentialsService } from '@/modules/payments/services/gateway-credentials-service';
import { PaymentMethodService } from '@/modules/payment-methods/services/payment-method-service';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/subscription/setup-complete
 * 
 * Handles completion of Stripe Setup Session for payment method updates.
 * This is called after the user completes the Stripe Checkout setup flow.
 * 
 * Body:
 * - sessionId: string (Stripe setup session ID)
 * 
 * Flow:
 * 1. Retrieve the setup session from Stripe
 * 2. Get the payment method from the session
 * 3. Save the payment method to the user's account
 * 4. Update the subscription's default payment method
 * 5. Return success
 */
export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(req);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get Stripe credentials
    const { credentials } = await GatewayCredentialsService.getActiveProviderCredentials('stripe', 'auto');
    const stripe = new Stripe(credentials.secret_key, { apiVersion: '2023-10-16' });

    // Retrieve the setup session with expanded setup_intent
    let session: any;
    try {
      session = await (stripe.checkout.sessions as any).retrieve(sessionId, {
        expand: ['setup_intent'],
      });
    } catch (stripeError) {
      console.error('[SetupComplete] Failed to retrieve session:', stripeError);
      return NextResponse.json({ error: 'Setup session not found' }, { status: 404 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Setup session not found' }, { status: 404 });
    }

    // Verify the session belongs to this user
    if (session.client_reference_id !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
    }

    // Get the setup intent and payment method
    if (!session.setup_intent) {
      return NextResponse.json({ error: 'No setup intent found in session' }, { status: 400 });
    }

    // The setup_intent can be either a string ID or an expanded object
    let setupIntent: any;
    if (typeof session.setup_intent === 'string') {
      setupIntent = await (stripe as any).setupIntents.retrieve(session.setup_intent);
    } else {
      setupIntent = session.setup_intent;
    }

    if (!setupIntent.payment_method || typeof setupIntent.payment_method !== 'string') {
      return NextResponse.json({ error: 'No payment method found in setup intent' }, { status: 400 });
    }

    const paymentMethodId = setupIntent.payment_method;

    // Save the payment method to the user's account
    const paymentMethodService = new PaymentMethodService(supabase);
    const paymentMethod = await paymentMethodService.addPaymentMethod(
      user.id,
      paymentMethodId,
      true // Set as default
    );

    // Update the subscription's default payment method
    const subscriptionRepo = new SubscriptionRepository(supabase);
    const subscription = await subscriptionRepo.findByUserId(user.id);

    if (subscription) {
      await subscriptionRepo.upsertSubscription({
        userId: user.id,
        status: subscription.status,
        periodEnd: subscription.current_period_end,
        gateway: 'stripe',
        defaultPaymentMethodId: paymentMethod.id,
      });
    }

    // Send notification email
    try {
      const { SubscriptionNotificationService } = await import('@/modules/multilevel/services/subscription-notification-service');
      const notificationService = new SubscriptionNotificationService(supabase);
      await notificationService.sendPaymentMethodUpdateEmail({
        userId: user.id,
        gateway: 'stripe',
        lastFour: paymentMethodId.slice(-4),
      });
    } catch (emailError) {
      console.error('[SetupComplete] Failed to send notification email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully',
      paymentMethodId: paymentMethod.id,
    });

  } catch (error) {
    console.error('[SetupComplete] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
