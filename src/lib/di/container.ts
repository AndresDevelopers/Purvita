import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface DIContainer {
  getSupabaseClient(): SupabaseClient;
  getServiceRoleClient(): SupabaseClient | null;
}

class SupabaseContainer implements DIContainer {
  private publicClient: SupabaseClient;
  private serviceRoleClient: SupabaseClient | null = null;
  private hasWarned = false;

  constructor(publicClient: SupabaseClient) {
    this.publicClient = publicClient;
  }

  getSupabaseClient(): SupabaseClient {
    return this.publicClient;
  }

  getServiceRoleClient(): SupabaseClient | null {
    if (this.serviceRoleClient) {
      return this.serviceRoleClient;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      if (!this.hasWarned) {
        console.warn('Supabase service role credentials are not configured. Falling back to public client for product module operations.');
        this.hasWarned = true;
      }
      return null;
    }

    this.serviceRoleClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return this.serviceRoleClient;
  }
}

export const createContainer = (publicClient: SupabaseClient): DIContainer => {
  return new SupabaseContainer(publicClient);
};