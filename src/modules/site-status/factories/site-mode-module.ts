import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, getServiceRoleClient } from '@/lib/supabase';
import type { SiteModeRepository } from '../domain/contracts/site-mode-repository';
import {
  SupabaseSiteModeRepository,
  type SupabaseSiteModeRepositoryDependencies,
} from '../data/repositories/supabase-site-mode-repository';

export interface SiteModeModule {
  repository: SiteModeRepository;
}

export interface CreateSiteModeModuleOverrides
  extends Partial<SupabaseSiteModeRepositoryDependencies> {
  componentClient?: SupabaseClient;
}

export const createSiteModeModule = (
  overrides: CreateSiteModeModuleOverrides = {},
): SiteModeModule => {
  const componentClient = overrides.componentClient ?? supabase;
  const adminClient = overrides.adminClient ?? getServiceRoleClient();

  const dependencies: SupabaseSiteModeRepositoryDependencies = {
    adminClient: adminClient ?? componentClient,
  };

  const repository = new SupabaseSiteModeRepository(dependencies);

  return { repository };
};
