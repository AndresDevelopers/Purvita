import type { SupabaseClient } from '@supabase/supabase-js';

export interface PayoutPreferencesRecord {
  user_id: string;
  auto_payout_threshold_cents: number;
  created_at: string;
  updated_at: string;
}

const isTableMissingError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? (error as { code?: string }).code : undefined;
  if (code === '42P01') {
    return true;
  }

  const message = 'message' in error ? (error as { message?: string }).message : undefined;
  return typeof message === 'string' && message.includes('does not exist');
};

export class PayoutPreferencesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<PayoutPreferencesRecord | null> {
    const { data, error } = await this.client
      .from('payout_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        return null;
      }

      throw error;
    }

    return (data as PayoutPreferencesRecord | null) ?? null;
  }

  async create(userId: string, thresholdCents: number): Promise<PayoutPreferencesRecord> {
    const { data, error } = await this.client
      .from('payout_preferences')
      .insert({
        user_id: userId,
        auto_payout_threshold_cents: thresholdCents,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return data as PayoutPreferencesRecord;
  }

  async update(userId: string, thresholdCents: number): Promise<PayoutPreferencesRecord> {
    const { data, error } = await this.client
      .from('payout_preferences')
      .update({
        auto_payout_threshold_cents: thresholdCents,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return data as PayoutPreferencesRecord;
  }

  async upsertThreshold(userId: string, thresholdCents: number): Promise<PayoutPreferencesRecord> {
    const existing = await this.findByUserId(userId);

    if (!existing) {
      return this.create(userId, thresholdCents);
    }

    if (existing.auto_payout_threshold_cents === thresholdCents) {
      return existing;
    }

    return this.update(userId, thresholdCents);
  }
}
