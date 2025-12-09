import { getSupabaseAdminClient } from '../infrastructure/supabase-admin-client';
import { DashboardSummaryService } from '../services/dashboard-summary-service';

export const createDashboardSummaryService = () => {
  return new DashboardSummaryService(getSupabaseAdminClient());
};
