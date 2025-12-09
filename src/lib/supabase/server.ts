import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { CookieOptions } from '@supabase/ssr';

type CookieStore = Awaited<ReturnType<(typeof import('next/headers'))['cookies']>>;

const getCookieStore = async (): Promise<CookieStore> => {
  try {
    const { cookies } = await import('next/headers');
    return cookies();
  } catch (error) {
    console.error('[Supabase Server] Error accessing cookies:', error);
    throw error;
  }
};

const setAllCookies = async (
  cookiesToSet: { name: string; value: string; options: CookieOptions }[],
): Promise<void> => {
  const cookieStore = await getCookieStore();

  cookiesToSet.forEach(({ name, value, options }) => {
    cookieStore.set({ name, value, ...options });
  });
};

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key are required');
  }

  return createServerClient(url, anonKey, {
    cookies: {
      async getAll() {
        try {
          const store = await getCookieStore();
          return store.getAll();
        } catch (error) {
          console.error('[Supabase Server] Error in getAll cookies:', error);
          return [];
        }
      },
      async setAll(cookiesToSet) {
        try {
          await setAllCookies(cookiesToSet);
        } catch (error) {
          console.error('[Supabase Server] Error in setAll cookies:', error);
          // Continue without setting cookies in case of error
        }
      },
    },
  });
}

// Create admin client with service role key for elevated permissions
// Uses createClient directly to bypass RLS policies
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[Supabase Admin] createAdminClient() must not be called in the browser. This function is server-only.'
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase URL and service role key are required for admin operations');
  }

  // Use createClient directly instead of createServerClient
  // This ensures the service role key is used without user session context
  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
