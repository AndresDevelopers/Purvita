import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logUserAction } from '@/lib/services/audit-log-service';
import { SupabaseClassVideoRepository, type SupabaseClassVideoRepositoryDependencies } from '../data/repositories/supabase-class-video-repository';
import type { ClassVideoRepository } from '../domain/contracts/class-video-repository';

export interface ClassVideoModule {
  repository: ClassVideoRepository;
}

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const _createServiceRoleClient = (() => {
  let client: SupabaseClient | null = null;
  return () => {
    if (client) {
      return client;
    }
    client = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return client;
  };
})();

const _createPublicClient = (() => {
  let client: SupabaseClient | null = null;
  return () => {
    if (client) {
      return client;
    }
    client = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
    return client;
  };
})();

const createDefaultDependencies = (): SupabaseClassVideoRepositoryDependencies => {
  console.log('🏭 createDefaultDependencies: Creando dependencias...');
  console.log('🏭 createDefaultDependencies: supabase client:', !!supabase);
  
  if (!supabase) {
    throw new Error('Supabase client is not initialized. Check environment variables.');
  }
  
  return {
    publicClient: supabase,
    serviceRoleClient: undefined,
    auditLogger: logUserAction,
  };
};

export const createClassVideoModule = (
  overrides: Partial<SupabaseClassVideoRepositoryDependencies> = {},
): ClassVideoModule => {
  const defaults = createDefaultDependencies();

  const dependencies: SupabaseClassVideoRepositoryDependencies = {
    publicClient: overrides.publicClient ?? defaults.publicClient,
    serviceRoleClient: overrides.serviceRoleClient ?? defaults.serviceRoleClient,
    auditLogger: overrides.auditLogger ?? defaults.auditLogger,
  };

  const repository = new SupabaseClassVideoRepository(dependencies);

  return { repository };
};