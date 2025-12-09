import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReferralRepository } from '../../domain/contracts/referral-repository';
import type { ReferralSponsor } from '../../domain/entities/referral-sponsor';

const pickString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class SupabaseReferralRepository implements ReferralRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByReferralCode(code: string): Promise<ReferralSponsor | null> {
    const normalized = pickString(code);
    if (!normalized) {
      return null;
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('id, name, email, referral_code')
      .eq('referral_code', normalized)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup referral code: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapRow(data);
  }

  async findByUserId(userId: string): Promise<ReferralSponsor | null> {
    const normalized = pickString(userId);
    if (!normalized) {
      return null;
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('id, name, email, referral_code')
      .eq('id', normalized)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup sponsor by id: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapRow(data);
  }

  private mapRow(row: Record<string, unknown>): ReferralSponsor {
    const id = pickString(row.id);

    if (!id) {
      throw new Error('Invalid sponsor record received from Supabase: missing id');
    }

    return {
      id,
      name: pickString(row.name),
      email: pickString(row.email),
      referralCode: pickString(row.referral_code),
    };
  }
}
