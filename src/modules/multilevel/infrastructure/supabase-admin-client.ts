import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodIssue } from 'zod';
import { EnvironmentConfigurationError } from '@/lib/env';
import { getServiceRoleClient } from '@/lib/supabase';

let cachedClient: SupabaseClient | null = null;

export const getSupabaseAdminClient = (): SupabaseClient => {
  if (!cachedClient) {
    try {
      const client = getServiceRoleClient();

      if (!client) {
        const missingKeyIssue: ZodIssue = {
          code: 'custom',
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'Required',
        };

        throw new EnvironmentConfigurationError([missingKeyIssue]);
      }

      cachedClient = client;
    } catch (error) {
      if (error instanceof EnvironmentConfigurationError) {
        throw error;
      }
      throw new EnvironmentConfigurationError([
        { code: 'custom', message: 'Unknown error while loading Supabase configuration', path: [] },
      ]);
    }
  }
  return cachedClient;
};
