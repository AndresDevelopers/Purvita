import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PaymentMethodService } from '@/modules/payment-methods/services/payment-method-service';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/subscription/update-payment-method
 * 
 * Updates the default payment method for a user's subscription WITHOUT charging immediately.
 * The payment method will be used for automatic renewals when the subscription period ends.
 * 
 * Body:
 * - provider: 'stripe' | 'paypal' (payment provider)
 * - paymentMethodId?: string (Stripe payment method ID, required for Stripe)
 * - setAsDefault?: boolean (whether to set as default payment method)
 * 
 * Flow:
 * 1. Validate authenticated user
 * 2. Get or create payment method in payment_methods table
 * 3. Link payment method to subscription (update default_payment_method_id)
 * 4. Return success (NO immediate charge)
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
    const { provider, paymentMethodId, setAsDefault = true } = body;

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Validate provider
    if (!['stripe', 'paypal', 'wallet'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // For Stripe, we need a payment method ID
    // If not provided, the user should go through the checkout flow instead
    if (provider === 'stripe' && !paymentMethodId) {
      return NextResponse.json({ 
        error: 'Payment method ID is required for Stripe. Please use the checkout flow to add a payment method.',
        code: 'STRIPE_PAYMENT_METHOD_REQUIRED'
      }, { status: 400 });
    }

    // Use admin client for subscription operations (RLS requires service_role for writes)
    const adminClient = createAdminClient();
    const subscriptionRepo = new SubscriptionRepository(adminClient);
    const subscription = await subscriptionRepo.findByUserId(user.id);

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Validate subscription status
    const validStatuses = ['active', 'past_due', 'canceled', 'unpaid'];
    if (!subscription.status || !validStatuses.includes(subscription.status)) {
      console.error('[UpdatePaymentMethod] Invalid subscription status:', subscription.status);
      return NextResponse.json({ 
        error: 'Invalid subscription status. Please contact support.',
        code: 'INVALID_SUBSCRIPTION_STATUS'
      }, { status: 400 });
    }

    let savedPaymentMethodId: string | null = null;

    // Handle Stripe payment method
    if (provider === 'stripe' && paymentMethodId) {
      const paymentMethodService = new PaymentMethodService(supabase);
      
      try {
        // Add payment method to user's account
        const paymentMethod = await paymentMethodService.addPaymentMethod(
          user.id,
          paymentMethodId,
          setAsDefault
        );
        
        savedPaymentMethodId = paymentMethod.id;
      } catch (error) {
        console.error('[UpdatePaymentMethod] Failed to add Stripe payment method:', error);
        const message = error instanceof Error ? error.message : 'Failed to add payment method';
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // Handle PayPal - for now, we just update the gateway
    // PayPal doesn't have saved payment methods like Stripe
    if (provider === 'paypal') {
      // Update subscription gateway to PayPal
      await subscriptionRepo.updateStatusByUserId(user.id, subscription.status, {
        defaultPaymentMethodId: null, // PayPal doesn't use saved payment methods
      });

      // Update gateway
      await subscriptionRepo.upsertSubscription({
        userId: user.id,
        status: subscription.status,
        periodEnd: subscription.current_period_end,
        gateway: 'paypal',
        defaultPaymentMethodId: null,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment method updated to PayPal. You will be redirected to PayPal for future renewals.',
        provider: 'paypal',
      });
    }

    // Handle Wallet
    if (provider === 'wallet') {
      await subscriptionRepo.upsertSubscription({
        userId: user.id,
        status: subscription.status,
        periodEnd: subscription.current_period_end,
        gateway: 'wallet',
        defaultPaymentMethodId: null,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment method updated to Wallet. Future renewals will use your wallet balance.',
        provider: 'wallet',
      });
    }

    // Update subscription with new default payment method (Stripe)
    if (savedPaymentMethodId) {
      await subscriptionRepo.updateStatusByUserId(user.id, subscription.status, {
        defaultPaymentMethodId: savedPaymentMethodId,
      });

      // Also update gateway to Stripe
      await subscriptionRepo.upsertSubscription({
        userId: user.id,
        status: subscription.status,
        periodEnd: subscription.current_period_end,
        gateway: 'stripe',
        defaultPaymentMethodId: savedPaymentMethodId,
      });

      // Send notification email for Stripe
      try {
        const { SubscriptionNotificationService } = await import('@/modules/multilevel/services/subscription-notification-service');
        const notificationService = new SubscriptionNotificationService(supabase);
        await notificationService.sendPaymentMethodUpdateEmail({
          userId: user.id,
          gateway: 'stripe',
          lastFour: savedPaymentMethodId.slice(-4),
        });
      } catch (emailError) {
        console.error('[UpdatePaymentMethod] Failed to send notification email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Payment method updated successfully. This card will be used for future renewals.',
        provider: 'stripe',
        paymentMethodId: savedPaymentMethodId,
      });
    }

    // Send notification email for PayPal/Wallet
    try {
      const { SubscriptionNotificationService } = await import('@/modules/multilevel/services/subscription-notification-service');
      const notificationService = new SubscriptionNotificationService(supabase);
      await notificationService.sendPaymentMethodUpdateEmail({
        userId: user.id,
        gateway: provider,
      });
    } catch (emailError) {
      console.error('[UpdatePaymentMethod] Failed to send notification email:', emailError);
    }

    return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 });

  } catch (error) {
    console.error('[UpdatePaymentMethod] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

