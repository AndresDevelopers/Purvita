import type { SupabaseClient } from '@supabase/supabase-js';

export type PayoutProvider = 'stripe' | 'paypal' | 'authorize_net' | 'payoneer';

export type PayoutAccountStatus = 'pending' | 'active' | 'restricted' | 'disabled';

export interface PayoutAccountRecord {
  user_id: string;
  provider: PayoutProvider;
  account_id: string | null;
  status: PayoutAccountStatus;
  created_at: string;
  updated_at: string;
}

export class PayoutAccountRepository {
  constructor(private readonly client: SupabaseClient) { }

  async findByUserId(userId: string): Promise<PayoutAccountRecord | null> {
    const { data, error } = await this.client
      .from('payout_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : null;
      if (code === 'PGRST116' || code === '42P01') {
        return null;
      }
      throw error;
    }

    return (data as PayoutAccountRecord | null) ?? null;
  }

  async createAccount(
    userId: string,
    provider: PayoutProvider,
    accountId: string | null,
    status: PayoutAccountStatus,
  ): Promise<PayoutAccountRecord> {
    const { data, error } = await this.client
      .from('payout_accounts')
      .insert({
        user_id: userId,
        provider,
        account_id: accountId,
        status,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return data as PayoutAccountRecord;
  }

  async updateAccount(
    userId: string,
    provider: PayoutProvider,
    payload: Partial<Pick<PayoutAccountRecord, 'account_id' | 'status'>>,
  ): Promise<PayoutAccountRecord | null> {
    const updates: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };

    const { data, error } = await this.client
      .from('payout_accounts')
      .update(updates)
      .eq('user_id', userId)
      .eq('provider', provider)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as PayoutAccountRecord | null) ?? null;
  }

  async deleteAccount(userId: string): Promise<void> {
    const { error } = await this.client.from('payout_accounts').delete().eq('user_id', userId);

    if (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : null;
      if (code === '42P01') {
        return;
      }
      throw error;
    }
  }
}
