import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SubscriptionCancellationReason,
  SubscriptionEventBus,
  SubscriptionPaymentRecordedPayload,
} from '../observers/subscription-event-bus';
import type { SubscriptionRecord } from '../domain/types';
import { PaymentRepository } from '../repositories/payment-repository';
import { PhaseRepository } from '../repositories/phase-repository';
import { SubscriptionRepository } from '../repositories/subscription-repository';
import { SentryLogger as _SentryLogger } from '../../observability/services/sentry-logger';
import { logUserAction } from '@/lib/services/audit-log-service';

export interface PaymentResult {
  alreadyProcessed: boolean;
}

export interface CancelSubscriptionInput {
  userId: string;
  reason: SubscriptionCancellationReason;
  locale?: string | null;
}

export interface CancelSubscriptionResult {
  canceled: boolean;
  alreadyCanceled: boolean;
  subscription: SubscriptionRecord | null;
}

export class SubscriptionLifecycleService {
  private readonly payments: PaymentRepository;
  private readonly subscriptions: SubscriptionRepository;
  private readonly phases: PhaseRepository;

  constructor(
    private readonly client: SupabaseClient,
    private readonly bus: SubscriptionEventBus
  ) {
    this.payments = new PaymentRepository(client);
    this.subscriptions = new SubscriptionRepository(client);
    this.phases = new PhaseRepository(client);
  }

  async handleConfirmedPayment(payload: SubscriptionPaymentRecordedPayload): Promise<PaymentResult> {
    const existing = await this.payments.findByGatewayRef(payload.gatewayRef);
    if (existing) {
      return { alreadyProcessed: true };
    }

    await this.payments.insert({
      userId: payload.userId,
      amountCents: payload.amountCents,
      status: 'paid',
      kind: 'subscription',
      gateway: payload.gateway,
      gatewayRef: payload.gatewayRef,
      periodEnd: payload.periodEnd,
    });

    this.bus.notify({ type: 'payment.recorded', payload });

    const subscription = await this.subscriptions.upsertSubscription({
      userId: payload.userId,
      planId: payload.planId,
      status: 'active',
      periodEnd: payload.periodEnd,
      gateway: payload.gateway,
    });

    await this.phases.ensureBasePhase(payload.userId);

    // Recalculate user's phase
    // Note: The database trigger 'trigger_recalculate_phases_on_subscription_active'
    // automatically recalculates all sponsor phases in cascade when subscription becomes active.
    // This RPC call is kept for backward compatibility and explicit phase calculation.
    await this.client.rpc('recalculate_phase', { p_user: payload.userId });

    this.bus.notify({
      type: 'subscription.updated',
      payload: { subscription },
    });

    // Log audit trail for subscription activation
    if (subscription) {
      try {
        await logUserAction('SUBSCRIPTION_ACTIVATED', 'subscription', subscription.id, {
          userId: payload.userId,
          amountCents: payload.amountCents,
          gateway: payload.gateway,
          periodEnd: payload.periodEnd,
        });
      } catch (auditError) {
        console.warn('[SubscriptionLifecycle] Failed to log subscription activation audit:', auditError);
      }
    }

    return { alreadyProcessed: false };
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    const existing = await this.subscriptions.findByUserId(input.userId);

    if (!existing) {
      return { canceled: false, alreadyCanceled: false, subscription: null };
    }

    if (existing.status === 'canceled' || existing.cancel_at_period_end) {
      this.bus.notify({
        type: 'subscription.canceled',
        payload: {
          userId: input.userId,
          subscription: existing,
          previousStatus: existing.status,
          reason: input.reason,
          locale: input.locale ?? null,
        },
      });
      return { canceled: false, alreadyCanceled: true, subscription: existing };
    }

    const updated = await this.subscriptions.updateStatusByUserId(input.userId, existing.status, {
      cancelAtPeriodEnd: true,
    });

    if (updated) {
      this.bus.notify({
        type: 'subscription.updated',
        payload: { subscription: updated },
      });
    }

    this.bus.notify({
      type: 'subscription.canceled',
      payload: {
        userId: input.userId,
        subscription: updated ?? existing,
        previousStatus: existing.status,
        reason: input.reason,
        locale: input.locale ?? null,
      },
    });

    // Log audit trail for subscription cancellation
    try {
      const finalSubscription = updated ?? existing;
      await logUserAction('SUBSCRIPTION_CANCELED', 'subscription', finalSubscription.id, {
        userId: input.userId,
        reason: input.reason,
        previousStatus: existing.status,
        gateway: finalSubscription.gateway,
      });
    } catch (auditError) {
      console.warn('[SubscriptionLifecycle] Failed to log subscription cancellation audit:', auditError);
    }

    return { canceled: true, alreadyCanceled: false, subscription: updated ?? existing };
  }
}
