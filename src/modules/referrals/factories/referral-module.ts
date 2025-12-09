import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ReferralRepository } from '../domain/contracts/referral-repository';
import { SupabaseReferralRepository } from '../data/repositories/supabase-referral-repository';
import { ReferralService } from '../services/referral-service';

export interface ReferralModule {
  repository: ReferralRepository;
  service: ReferralService;
}

const createAdminClient = (() => {
  let cached: SupabaseClient | null = null;
  let warned = false;

  return (): SupabaseClient | null => {
    if (typeof window !== 'undefined') {
      return null;
    }

    if (cached) {
      return cached;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      if (!warned) {
        console.warn(
          '[ReferralModule] Missing Supabase service role credentials. Falling back to anon client which may be restricted by RLS.',
        );
        warned = true;
      }
      return null;
    }

    cached = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    return cached;
  };
})();

export const createReferralModule = (): ReferralModule => {
  const adminClient = createAdminClient() ?? supabase;
  const repository = new SupabaseReferralRepository(adminClient);
  const service = new ReferralService(repository);

  return { repository, service };
};
