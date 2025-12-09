/**
 * Supabase Admin Client
 * Provides a singleton admin client with service role key for server-side operations
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let adminClientInstance: SupabaseClient | null = null;

/**
 * Get or create Supabase admin client with service role key
 * Uses singleton pattern to avoid creating multiple instances
 */
export function getAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[Supabase Admin] getAdminClient() must not be called in the browser. This function is server-only.'
    );
  }

  if (!adminClientInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClientInstance;
}

/**
 * Reset the admin client instance (useful for testing)
 */
export function resetAdminClient(): void {
  adminClientInstance = null;
}
