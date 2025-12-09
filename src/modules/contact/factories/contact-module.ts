import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleClient, supabase } from '@/lib/supabase';
import type { ContactRepository } from '../domain/contracts/contact-repository';
import { SupabaseContactRepository } from '../data/repositories/supabase-contact-repository';

export interface ContactModule {
  repository: ContactRepository;
}

export interface CreateContactModuleOverrides {
  adminClient?: SupabaseClient;
}

export const createContactModule = (
  overrides: CreateContactModuleOverrides = {},
): ContactModule => {
  const adminClient = overrides.adminClient ?? getServiceRoleClient() ?? supabase;

  const repository = new SupabaseContactRepository({
    adminClient,
  });

  return { repository };
};
