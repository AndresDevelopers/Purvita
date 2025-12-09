import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isInvalidRefreshTokenError } from './errors/supabase-errors'
import { EnvironmentService } from './config/environment'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  detectMissingSupabaseEnv,
  formatMissingSupabaseEnvMessage,
  type SupabaseEnvKey,
} from '@/lib/utils/supabase-env'

const BROWSER_CLIENT_ENV: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'public-anon-key'

const createSafeBrowserClient = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

  // Check if they're placeholder values
  const missingKeys = detectMissingSupabaseEnv(BROWSER_CLIENT_ENV)
  if (missingKeys.length > 0) {
    console.warn(`[Supabase] ${formatMissingSupabaseEnvMessage(missingKeys)}. Using placeholder credentials.`)
  }

  return createBrowserClient(url, anonKey)
}

export const supabase = createSafeBrowserClient()

// Service role client factory with proper caching and error handling
class ServiceRoleClientFactory {
  private static instance: ServiceRoleClientFactory
  private client: SupabaseClient | null = null
  private hasWarned = false

  static getInstance(): ServiceRoleClientFactory {
    if (!ServiceRoleClientFactory.instance) {
      ServiceRoleClientFactory.instance = new ServiceRoleClientFactory()
    }
    return ServiceRoleClientFactory.instance
  }

  getClient(): SupabaseClient | null {
    if (typeof window !== 'undefined') {
      if (!this.hasWarned) {
        console.error('[Supabase] getServiceRoleClient() must not be called in the browser. Returning null.')
        this.hasWarned = true
      }
      return null
    }

    const env = EnvironmentService.getInstance()
    const config = env.getConfig()

    if (!env.hasServiceRoleKey()) {
      if (!this.hasWarned) {
        console.warn('Supabase service role credentials are not configured. Some operations may be limited.')
        this.hasWarned = true
      }
      return null
    }

    if (!this.client) {
      this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    }

    return this.client
  }
}

export const getServiceRoleClient = (): SupabaseClient | null => {
  return ServiceRoleClientFactory.getInstance().getClient()
}

type SafeSessionResponse = Awaited<ReturnType<typeof supabase.auth.getSession>>

export const getSafeSession = async (): Promise<SafeSessionResponse> => {
    try {
        return await supabase.auth.getSession()
    } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
            console.warn('Supabase session cookie contained a stale refresh token. Clearing session.')
            try {
                await supabase.auth.signOut({ scope: 'local' })
            } catch (signOutError) {
                console.warn('Error clearing Supabase session after invalid refresh token.', signOutError)
            }
            return { data: { session: null }, error: null }
        }

        throw error
    }
}

// Storage bucket for product images - now configurable
export const PRODUCTS_BUCKET = EnvironmentService.getInstance().getConfig().productsBucket

// Storage bucket for page content images
export const PAGE_BUCKET = 'page'

// Storage bucket for marketing assets (images & video thumbnails)
export const MARKETING_ASSETS_BUCKET = 'marketing-assets'

// Utility function to clear invalid sessions
export const clearInvalidSession = async (): Promise<void> => {
    try {
        await supabase.auth.signOut({ scope: 'local' })
        // Clear any remaining storage items
        if (typeof window !== 'undefined') {
            localStorage.removeItem('supabase.auth.token')
            sessionStorage.removeItem('supabase.auth.token')
        }
    } catch (error) {
        console.warn('Error clearing session:', error)
    }
}
