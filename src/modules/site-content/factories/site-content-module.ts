import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, getServiceRoleClient } from '@/lib/supabase';
import type { SiteContentRepository } from '../domain/contracts/site-content-repository';
import {
  SupabaseSiteContentRepository,
  type SupabaseSiteContentRepositoryDependencies,
} from '../data/repositories/supabase-site-content-repository';

export interface SiteContentModule {
  repository: SiteContentRepository;
}

export interface CreateSiteContentModuleOverrides
  extends Partial<SupabaseSiteContentRepositoryDependencies> {
  componentClient?: SupabaseClient;
}

export const createSiteContentModule = (
  overrides: CreateSiteContentModuleOverrides = {},
): SiteContentModule => {
  const componentClient = overrides.componentClient ?? supabase;

  // Prefer service role client only on the server. In the browser we must
  // never try to create or use a service-role client, so we fall back to
  // the public component client.
  let adminClient = overrides.adminClient;

  if (!adminClient) {
    if (typeof window === 'undefined') {
      adminClient = getServiceRoleClient() ?? componentClient;
    } else {
      adminClient = componentClient;
    }
  }

  const repository = new SupabaseSiteContentRepository({
    adminClient,
  });

  return { repository };
};
