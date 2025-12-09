import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logUserAction } from '@/lib/services/audit-log-service';
import type { UserRepository } from '../domain/contracts/user-repository';
import {
  SupabaseUserRepository,
  type SupabaseUserRepositoryDependencies,
} from '../data/repositories/supabase-user-repository';

export interface UserModule {
  repository: UserRepository;
}

const _getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const getOptionalEnv = (key: string): string | null => process.env[key] ?? null;

const createAdminClient = (() => {
  let hasWarned = false;

  return (): SupabaseClient | null => {
    if (typeof window !== 'undefined') {
      return null;
    }

    const url = getOptionalEnv('NEXT_PUBLIC_SUPABASE_URL');
    const key = getOptionalEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      if (!hasWarned) {
        console.warn('Supabase service role credentials are not configured. Admin operations will use the authenticated client.');
        hasWarned = true;
      }
      return null;
    }

    return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  };
})();

export const createUserModule = (
  overrides: Partial<SupabaseUserRepositoryDependencies> = {},
): UserModule => {
  const componentClient = overrides.componentClient ?? supabase;
  const serviceRoleClient = overrides.adminClient ?? createAdminClient();

  const dependencies: SupabaseUserRepositoryDependencies = {
    adminClient: serviceRoleClient ?? componentClient,
    componentClient,
    auditLogger: overrides.auditLogger ?? logUserAction,
  };

  const repository = new SupabaseUserRepository(dependencies);

  return { repository };
};
