import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleClient, supabase } from '@/lib/supabase';
import type { AppSettingsRepository } from '../domain/contracts/app-settings-repository';
import { SupabaseAppSettingsRepository } from '../data/repositories/supabase-app-settings-repository';

export interface AppSettingsModule {
  repository: AppSettingsRepository;
}

export interface CreateAppSettingsModuleOverrides {
  adminClient?: SupabaseClient;
}

export const createAppSettingsModule = (
  overrides: CreateAppSettingsModuleOverrides = {},
): AppSettingsModule => {
  const adminClient = overrides.adminClient ?? getServiceRoleClient() ?? supabase;

  const repository = new SupabaseAppSettingsRepository({
    adminClient,
  });

  return { repository };
};
