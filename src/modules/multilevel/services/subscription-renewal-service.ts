import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { Stripe as StripeTypes } from 'stripe';
import { SubscriptionRepository } from '../repositories/subscription-repository';
import { PaymentRepository } from '../repositories/payment-repository';
import { SubscriptionLifecycleService } from './subscription-lifecycle-service';
import { SubscriptionEventBus } from '../observers/subscription-event-bus';
import { randomUUID } from 'crypto';

type StripeClient = InstanceType<typeof Stripe>;
type StripePaymentIntentsResource = StripeTypes['paymentIntents'];
type StripeApiClient = StripeClient & {
  paymentIntents: StripePaymentIntentsResource;
};

interface RenewalResult {
  userId: string;
  success: boolean;
  error?: string;
  amountCents?: number;
  gateway?: string;
}

interface RenewalSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: RenewalResult[];
}

/**
 * Service for handling automatic subscription renewals
 * 
 * This service:
 * 1. Finds subscriptions that are about to expire (within 1 day)
 * 2. Checks if automatic renewal is enabled (cancel_at_period_end = false)
 * 3. Processes payment using the saved default payment method
 * 4. Updates subscription period_end to +30 days
 * 5. Handles payment failures gracefully
 */
export class SubscriptionRenewalService {
  private readonly subscriptions: SubscriptionRepository;
  private readonly payments: PaymentRepository;
  private readonly lifecycle: SubscriptionLifecycleService;

  constructor(
    private readonly client: SupabaseClient,
    private readonly bus: SubscriptionEventBus = new SubscriptionEventBus()
  ) {
    this.subscriptions = new SubscriptionRepository(client);
    this.payments = new PaymentRepository(client);
    this.lifecycle = new SubscriptionLifecycleService(client, bus);
  }

  /**
   * Process all subscriptions that need renewal
   * 
   * @param daysBeforeExpiry - Number of days before expiry to process renewals (default: 1)
   * @returns Summary of renewal processing
   */
  async processRenewals(daysBeforeExpiry: number = 1): Promise<RenewalSummary> {
    console.log('[SubscriptionRenewal] Starting renewal processing...');

    const summary: RenewalSummary = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      results: [],
    };

    try {
      // Find subscriptions that need renewal
      const subscriptionsToRenew = await this.findSubscriptionsNeedingRenewal(daysBeforeExpiry);
      
      console.log(`[SubscriptionRenewal] Found ${subscriptionsToRenew.length} subscriptions to renew`);
      summary.totalProcessed = subscriptionsToRenew.length;

      // Process each subscription
      for (const subscription of subscriptionsToRenew) {
        const result = await this.renewSubscription(subscription.user_id);
        summary.results.push(result);

        if (result.success) {
          summary.successful++;
        } else {
          summary.failed++;
        }
      }

      console.log('[SubscriptionRenewal] Renewal processing complete:', {
        total: summary.totalProcessed,
        successful: summary.successful,
        failed: summary.failed,
      });

      return summary;
    } catch (error) {
      console.error('[SubscriptionRenewal] Error processing renewals:', error);
      throw error;
    }
  }

  /**
   * Find subscriptions that need renewal
   * 
   * Criteria:
   * - Status is 'active' or 'past_due'
   * - cancel_at_period_end is false
   * - current_period_end is within the specified days
   * - Has a default_payment_method_id (for Stripe) or gateway is 'wallet'/'paypal'
   */
  private async findSubscriptionsNeedingRenewal(daysBeforeExpiry: number) {
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from('subscriptions')
      .select('*')
      .in('status', ['active', 'past_due'])
      .eq('cancel_at_period_end', false)
      .not('current_period_end', 'is', null)
      .lte('current_period_end', expiryThreshold.toISOString());

    if (error) {
      throw error;
    }

    // Filter subscriptions that have a payment method or use wallet/paypal
    return (data || []).filter(sub => {
      // Wallet and PayPal don't need saved payment methods
      if (sub.gateway === 'wallet' || sub.gateway === 'paypal') {
        return true;
      }
      // Stripe requires a saved payment method
      if (sub.gateway === 'stripe' && sub.default_payment_method_id) {
        return true;
      }
      return false;
    });
  }

  /**
   * Renew a single subscription
   */
  private async renewSubscription(userId: string): Promise<RenewalResult> {
    console.log(`[SubscriptionRenewal] Processing renewal for user ${userId}`);

    try {
      const subscription = await this.subscriptions.findByUserId(userId);

      if (!subscription) {
        return {
          userId,
          success: false,
          error: 'Subscription not found',
        };
      }

      // Check if renewal is needed
      if (subscription.cancel_at_period_end) {
        return {
          userId,
          success: false,
          error: 'Subscription is set to cancel at period end',
        };
      }

      // Get subscription plan price (you may need to adjust this based on your plan structure)
      const planPriceCents = 3499; // Default price, should be fetched from plans table

      let result: RenewalResult;

      switch (subscription.gateway) {
        case 'stripe':
          result = await this.renewWithStripe(userId, subscription.default_payment_method_id, planPriceCents);
          break;
        case 'wallet':
          result = await this.renewWithWallet(userId, planPriceCents);
          break;
        case 'paypal':
          result = await this.renewWithPayPal(userId, planPriceCents);
          break;
        default:
          result = {
            userId,
            success: false,
            error: `Unsupported gateway: ${subscription.gateway}`,
          };
      }

      return result;
    } catch (error) {
      console.error(`[SubscriptionRenewal] Error renewing subscription for user ${userId}:`, error);
      return {
        userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Renew subscription using Stripe
   */
  private async renewWithStripe(
    userId: string,
    paymentMethodId: string | null,
    amountCents: number
  ): Promise<RenewalResult> {
    if (!paymentMethodId) {
      return {
        userId,
        success: false,
        error: 'No payment method saved for Stripe renewal',
      };
    }

    try {
      // Get Stripe credentials
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        throw new Error('Stripe secret key not configured');
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-03-31',
      }) as StripeApiClient;

      // Get payment method details
      const { data: paymentMethod } = await this.client
        .from('payment_methods')
        .select('stripe_payment_method_id, user_id')
        .eq('id', paymentMethodId)
        .eq('user_id', userId)
        .single();

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        payment_method: paymentMethod.stripe_payment_method_id,
        customer: undefined, // You may need to get customer ID from profile
        confirm: true,
        off_session: true, // Important for automatic renewals
        metadata: {
          userId,
          intent: 'subscription_renewal',
        },
      });

      if (paymentIntent.status === 'succeeded') {
        // Record payment and update subscription
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const gatewayRef = `stripe:renewal:${paymentIntent.id}`;

        await this.lifecycle.handleConfirmedPayment({
          userId,
          amountCents,
          gatewayRef,
          periodEnd,
          gateway: 'stripe',
        });

        // Send success notification
        try {
          const { SubscriptionNotificationService } = await import('./subscription-notification-service');
          const notificationService = new SubscriptionNotificationService(this.client);
          await notificationService.sendRenewalSuccessEmail({
            userId,
            amountCents,
            currency: 'USD',
            nextBillingDate: periodEnd,
            gateway: 'stripe',
          });
        } catch (emailError) {
          console.error('[SubscriptionRenewal] Failed to send success email:', emailError);
        }

        return {
          userId,
          success: true,
          amountCents,
          gateway: 'stripe',
        };
      } else {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }
    } catch (error) {
      console.error(`[SubscriptionRenewal] Stripe renewal failed for user ${userId}:`, error);

      // Mark subscription as past_due
      await this.subscriptions.updateStatusByUserId(userId, 'past_due');

      // Send failure notification
      try {
        const { SubscriptionNotificationService } = await import('./subscription-notification-service');
        const notificationService = new SubscriptionNotificationService(this.client);
        await notificationService.sendRenewalFailureEmail({
          userId,
          amountCents,
          currency: 'USD',
          reason: error instanceof Error ? error.message : 'Payment processing failed',
          gateway: 'stripe',
        });
      } catch (emailError) {
        console.error('[SubscriptionRenewal] Failed to send failure email:', emailError);
      }

      return {
        userId,
        success: false,
        error: error instanceof Error ? error.message : 'Stripe payment failed',
        gateway: 'stripe',
      };
    }
  }

  /**
   * Renew subscription using Wallet
   */
  private async renewWithWallet(userId: string, amountCents: number): Promise<RenewalResult> {
    try {
      // Check wallet balance
      const { data: wallet } = await this.client
        .from('wallets')
        .select('balance_cents')
        .eq('user_id', userId)
        .single();

      if (!wallet || wallet.balance_cents < amountCents) {
        // Mark subscription as past_due
        await this.subscriptions.updateStatusByUserId(userId, 'past_due');

        // Send failure notification
        try {
          const { SubscriptionNotificationService } = await import('./subscription-notification-service');
          const notificationService = new SubscriptionNotificationService(this.client);
          await notificationService.sendRenewalFailureEmail({
            userId,
            amountCents,
            currency: 'USD',
            reason: 'Insufficient wallet balance',
            gateway: 'wallet',
          });
        } catch (emailError) {
          console.error('[SubscriptionRenewal] Failed to send failure email:', emailError);
        }

        return {
          userId,
          success: false,
          error: 'Insufficient wallet balance',
          gateway: 'wallet',
        };
      }

      // Deduct from wallet
      await this.client
        .from('wallets')
        .update({ balance_cents: wallet.balance_cents - amountCents })
        .eq('user_id', userId);

      // Record payment and update subscription
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const gatewayRef = `wallet:renewal:${userId}:${randomUUID()}`;

      await this.lifecycle.handleConfirmedPayment({
        userId,
        amountCents,
        gatewayRef,
        periodEnd,
        gateway: 'wallet',
      });

      // Send success notification
      try {
        const { SubscriptionNotificationService } = await import('./subscription-notification-service');
        const notificationService = new SubscriptionNotificationService(this.client);
        await notificationService.sendRenewalSuccessEmail({
          userId,
          amountCents,
          currency: 'USD',
          nextBillingDate: periodEnd,
          gateway: 'wallet',
        });
      } catch (emailError) {
        console.error('[SubscriptionRenewal] Failed to send success email:', emailError);
      }

      return {
        userId,
        success: true,
        amountCents,
        gateway: 'wallet',
      };
    } catch (error) {
      console.error(`[SubscriptionRenewal] Wallet renewal failed for user ${userId}:`, error);
      return {
        userId,
        success: false,
        error: error instanceof Error ? error.message : 'Wallet payment failed',
        gateway: 'wallet',
      };
    }
  }

  /**
   * Renew subscription using PayPal Billing Agreement
   * PayPal handles recurring billing automatically through subscriptions
   */
  private async renewWithPayPal(userId: string, amountCents: number): Promise<RenewalResult> {
    try {
      const { PayPalBillingService } = await import('@/modules/payments/services/paypal-billing-service');
      const billingService = new PayPalBillingService(this.client);

      // Check if user has an active billing agreement
      const agreement = await billingService.getActiveBillingAgreement(userId);

      if (!agreement) {
        // No billing agreement - mark as past_due for manual renewal
        await this.subscriptions.updateStatusByUserId(userId, 'past_due');

        return {
          userId,
          success: false,
          error: 'No active PayPal billing agreement. User needs to set up PayPal subscription.',
          gateway: 'paypal',
        };
      }

      // With PayPal subscriptions, PayPal handles the renewal automatically
      // We just verify the agreement is active
      // PayPal will send webhooks when the payment is processed
      console.log(`[SubscriptionRenewal] PayPal subscription active for user ${userId}, agreement: ${agreement.paypalBillingAgreementId}`);

      return {
        userId,
        success: true,
        amountCents,
        gateway: 'paypal',
      };
    } catch (error) {
      console.error(`[SubscriptionRenewal] PayPal renewal check failed for user ${userId}:`, error);

      // Mark subscription as past_due
      await this.subscriptions.updateStatusByUserId(userId, 'past_due');

      return {
        userId,
        success: false,
        error: error instanceof Error ? error.message : 'PayPal renewal check failed',
        gateway: 'paypal',
      };
    }
  }
}

