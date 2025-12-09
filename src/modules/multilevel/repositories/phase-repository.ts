import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhaseRecord } from '../domain/types';
import { getGlobalCommissionRate } from '@/lib/helpers/settings-helper';

export class PhaseRepository {
  constructor(private readonly client: SupabaseClient) {}

  async ensureBasePhase(userId: string) {
    // Get user's commission_rate from profile
    const { data: profile } = await this.client
      .from('profiles')
      .select('commission_rate')
      .eq('id', userId)
      .maybeSingle();

    const commissionRate =
      profile?.commission_rate ?? (await getGlobalCommissionRate());

    const { error } = await this.client
      .from('phases')
      .upsert(
        {
          user_id: userId,
          phase: 0,
          ecommerce_commission: commissionRate,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw error;
    }
  }

  async findByUserId(userId: string) {
    const { data, error } = await this.client
      .from('phases')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PhaseRecord | null;
  }

  async getPhaseDistribution() {
    const { data, error } = await this.client
      .from('phases')
      .select('phase, user_id');

    if (error) {
      throw error;
    }

    const phaseCounts: Record<number, number> = {};
    const totalUsers = (data ?? []).length;

    (data ?? []).forEach((record) => {
      const phase = record.phase ?? 0;
      phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
    });

    return [0, 1, 2, 3].map((phase) => ({
      phase,
      count: phaseCounts[phase] ?? 0,
      percentage: totalUsers > 0 ? ((phaseCounts[phase] ?? 0) / totalUsers) * 100 : 0,
    }));
  }
}
