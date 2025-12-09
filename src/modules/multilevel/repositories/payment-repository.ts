import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentKind, PaymentRecord } from '../domain/types';

interface ListPaymentsOptions {
  limit?: number;
  includeArchived?: boolean;
  kind?: PaymentKind;
}

export class PaymentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByGatewayRef(gatewayRef: string) {
    const { data, error } = await this.client
      .from('payments')
      .select('id')
      .eq('gateway_ref', gatewayRef)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as { id: string } | null;
  }

  async insert(payload: {
    userId: string;
    amountCents: number;
    status: 'paid';
    kind: 'subscription';
    gateway: 'stripe' | 'paypal' | 'wallet';
    gatewayRef: string;
    periodEnd: string | null;
  }) {
    const { data, error } = await this.client
      .from('payments')
      .insert({
        id: randomUUID(),
        user_id: payload.userId,
        amount_cents: payload.amountCents,
        status: payload.status,
        kind: payload.kind,
        gateway: payload.gateway,
        gateway_ref: payload.gatewayRef,
        period_end: payload.periodEnd,
        archived: false,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PaymentRecord | null;
  }

  async listByUser(userId: string, options: ListPaymentsOptions = {}) {
    const limit = options.limit && options.limit > 0 ? options.limit : 50;
    const query = this.client
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.kind) {
      query.eq('kind', options.kind);
    }

    if (!options.includeArchived) {
      query.eq('archived', false);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []) as PaymentRecord[];
  }

  async listRecentByUser(userId: string, limit = 20) {
    return this.listByUser(userId, { limit, includeArchived: true });
  }

  async findById(id: string) {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as PaymentRecord | null) ?? null;
  }

  async findByIdForUser(userId: string, id: string) {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as PaymentRecord | null) ?? null;
  }

  async updateArchiveStatus(userId: string, invoiceIds: string[], archived: boolean) {
    if (invoiceIds.length === 0) {
      return [] as PaymentRecord[];
    }

    const { data, error } = await this.client
      .from('payments')
      .update({ archived })
      .eq('user_id', userId)
      .in('id', invoiceIds)
      .select('*');

    if (error) {
      throw error;
    }

    return (data ?? []) as PaymentRecord[];
  }

  async sumSubscriptionRevenue() {
    const { data, error } = await this.client
      .from('payments')
      .select('amount_cents')
      .eq('status', 'paid')
      .eq('kind', 'subscription');

    if (error) {
      throw error;
    }

    const total = (data ?? []).reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
    return total;
  }
}
