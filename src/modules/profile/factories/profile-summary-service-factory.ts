import { getSupabaseAdminClient } from '@/modules/multilevel/infrastructure/supabase-admin-client';
import { ProfileSummaryService } from '../services/profile-summary-service';

export const createProfileSummaryService = () => {
  return new ProfileSummaryService(getSupabaseAdminClient());
};
