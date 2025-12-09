import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionRecord, SubscriptionStatus } from '../domain/types';

export type SubscriptionType = 'mlm' | 'affiliate';

export class SubscriptionRepository {
  constructor(private readonly client: SupabaseClient) { }

  /**
   * Find subscription by user ID and optional type.
   * If type is not specified, returns the active subscription first, 
   * or the latest subscription if none is active.
   * 
   * Priority: active subscription > latest by created_at
   */
  async findByUserId(userId: string, subscriptionType?: SubscriptionType) {
    let query = this.client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subscriptionType) {
      query = query.eq('subscription_type', subscriptionType);
    }

    // First, try to find an active subscription
    const { data: activeData, error: activeError } = await query
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      throw activeError;
    }

    // If found an active subscription, return it
    if (activeData) {
      return activeData as SubscriptionRecord;
    }

    // Otherwise, return the latest subscription (any status)
    // Need to rebuild query without the status filter
    let fallbackQuery = this.client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subscriptionType) {
      fallbackQuery = fallbackQuery.eq('subscription_type', subscriptionType);
    }

    const { data, error } = await fallbackQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as SubscriptionRecord | null;
  }

  /**
   * Find both MLM and Affiliate subscriptions for a user.
   */
  async findAllByUserId(userId: string) {
    const [mlmSubscription, affiliateSubscription] = await Promise.all([
      this.findByUserId(userId, 'mlm'),
      this.findByUserId(userId, 'affiliate'),
    ]);

    return { mlmSubscription, affiliateSubscription };
  }

  async upsertSubscription(payload: {
    userId: string;
    subscriptionType?: SubscriptionType;
    planId?: string | null;
    status: SubscriptionStatus;
    periodEnd: string | null;
    gateway: 'stripe' | 'paypal' | 'wallet';
    defaultPaymentMethodId?: string | null;
    cancelAtPeriodEnd?: boolean;
  }) {
    const subscriptionType = payload.subscriptionType ?? 'mlm'; // Default to 'mlm' for backward compatibility

    const baseRecord = {
      status: payload.status,
      current_period_end: payload.periodEnd ?? null,
      gateway: payload.gateway,
      cancel_at_period_end: payload.cancelAtPeriodEnd ?? false,
      subscription_type: subscriptionType,
      ...(payload.planId !== undefined && {
        plan_id: payload.planId,
      }),
      ...(payload.defaultPaymentMethodId !== undefined && {
        default_payment_method_id: payload.defaultPaymentMethodId,
      }),
    };

    // ✅ IMPORTANT: MLM and Affiliate subscriptions are mutually exclusive
    // When activating one type, cancel the other type if it exists
    if (payload.status === 'active') {
      const otherType: SubscriptionType = subscriptionType === 'mlm' ? 'affiliate' : 'mlm';
      
      // Find and cancel any active subscription of the other type
      const { data: otherSubscription } = await this.client
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', payload.userId)
        .eq('subscription_type', otherType)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otherSubscription) {
        // Cancel the other subscription type
        await this.client
          .from('subscriptions')
          .update({ 
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('id', otherSubscription.id);
        
        console.log(`[SubscriptionRepository] Canceled ${otherType} subscription (id: ${otherSubscription.id}) because ${subscriptionType} was activated for user ${payload.userId}`);
      }
    }

    // Look up existing subscription by user_id AND subscription_type
    const { data: existing, error: existingError } = await this.client
      .from('subscriptions')
      .select('id, created_at')
      .eq('user_id', payload.userId)
      .eq('subscription_type', subscriptionType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const { data, error } = await this.client
        .from('subscriptions')
        .update(baseRecord)
        .eq('id', existing.id)
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as SubscriptionRecord | null;
    }

    const { data, error } = await this.client
      .from('subscriptions')
      .insert({
        id: randomUUID(),
        user_id: payload.userId,
        ...baseRecord,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as SubscriptionRecord | null;
  }

  async countActive() {
    const { data, error } = await this.client.rpc('active_users_count');
    if (error) {
      throw error;
    }
    return (data as number | null) ?? null;
  }

  async countActiveFallback() {
    const { count, error } = await this.client
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async updateStatusByUserId(
    userId: string,
    status: SubscriptionStatus,
    options: {
      planId?: string | null;
      currentPeriodEnd?: string | null;
      cancelAtPeriodEnd?: boolean;
      defaultPaymentMethodId?: string | null;
    } = {},
  ) {
    const updates: Record<string, unknown> = {
      status,
    };

    if ('planId' in options) {
      updates.plan_id = options.planId ?? null;
    }

    if ('currentPeriodEnd' in options) {
      updates.current_period_end = options.currentPeriodEnd ?? null;
    }

    if ('cancelAtPeriodEnd' in options) {
      updates.cancel_at_period_end = Boolean(options.cancelAtPeriodEnd);
    }

    if ('defaultPaymentMethodId' in options) {
      updates.default_payment_method_id = options.defaultPaymentMethodId ?? null;
    }

    // Find latest subscription row id, then update by id to avoid multi-row update errors
    const { data: existing, error: existingError } = await this.client
      .from('subscriptions')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      // No existing row: insert new
      const { data, error } = await this.client
        .from('subscriptions')
        .insert({
          id: randomUUID(),
          user_id: userId,
          ...updates,
        })
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }
      return data as SubscriptionRecord | null;
    }

    const { data, error } = await this.client
      .from('subscriptions')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as SubscriptionRecord | null;
  }
}
