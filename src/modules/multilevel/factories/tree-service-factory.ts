import { getSupabaseAdminClient } from '../infrastructure/supabase-admin-client';
import { TreeService } from '../services/tree-service';

export const createTreeService = () => {
  return new TreeService(getSupabaseAdminClient());
};
