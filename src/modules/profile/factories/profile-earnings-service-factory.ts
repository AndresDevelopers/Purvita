import { getSupabaseAdminClient } from '@/modules/multilevel/infrastructure/supabase-admin-client';
import { ProfileEarningsService } from '../services/profile-earnings-service';

export const createProfileEarningsService = () => {
  return new ProfileEarningsService(getSupabaseAdminClient());
};
