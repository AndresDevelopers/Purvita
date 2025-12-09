import { getSupabaseAdminClient } from '../infrastructure/supabase-admin-client';
import { createSubscriptionEventBus } from '../observers/subscription-event-bus';
import { SubscriptionLifecycleService } from '../services/subscription-lifecycle-service';
import { SubscriptionNotificationService } from '../services/subscription-notification-service';
import { SubscriptionCommissionService } from '../services/subscription-commission-service';

export const createSubscriptionLifecycleService = () => {
  const client = getSupabaseAdminClient();
  const bus = createSubscriptionEventBus();
  const notificationService = new SubscriptionNotificationService(client);
  const commissionService = new SubscriptionCommissionService(client);

  // Debug logging for subscription updates
  bus.subscribe('subscription.updated', ({ payload }) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Subscription updated', payload);
    }
  });

  // Process subscription commissions when subscription becomes active
  bus.subscribe('subscription.updated', async ({ payload }) => {
    try {
      if (payload.subscription) {
        // Check if subscription was previously active to avoid duplicate commissions
        const wasActive = await commissionService.wasSubscriptionPreviouslyActive(payload.subscription.user_id);

        // Process commissions for the subscription payment
        const commissions = await commissionService.processSubscriptionCommission(
          payload.subscription,
          wasActive
        );

        if (commissions.length > 0) {
          console.log(`[SubscriptionFactory] Created ${commissions.length} subscription commissions for user ${payload.subscription.user_id}`);
        }
      }
    } catch (error) {
      console.error('Failed to process subscription commissions', error);
    }
  });

  // Handle subscription cancellation notifications
  bus.subscribe('subscription.canceled', async ({ payload }) => {
    try {
      await notificationService.sendCancellationEmail({
        userId: payload.userId,
        reason: payload.reason,
        locale: payload.locale,
      });
    } catch (error) {
      console.error('Failed to process subscription cancellation notification', error);
    }
  });

  return new SubscriptionLifecycleService(client, bus);
};
