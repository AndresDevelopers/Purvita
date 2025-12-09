/**
 * Admin Security Configuration Service
 * 
 * Centralizes access to security settings configured in the admin panel.
 * This ensures that all security policies (rate limiting, session timeout, CAPTCHA, etc.)
 * are consistently applied across the application, including affiliate pages.
 */

import { getAdminClient } from '@/lib/supabase/admin';

export interface AdminSecurityConfig {
  // Rate Limiting
  apiRateLimitRequests: number;
  apiRateLimitWindowMs: number;
  loginRateLimitAttempts: number;
  loginRateLimitWindowSeconds: number;
  
  // Auto-blocking
  autoBlockEnabled: boolean;
  autoBlockDurationHours: number;
  autoBlockMinConfidence: number;
  
  // CAPTCHA
  captchaEnabled: boolean;
  captchaProvider: 'recaptcha' | 'hcaptcha' | 'turnstile' | null;
  captchaThreshold: number;
  
  // Session
  sessionTimeoutMinutes: number;
  sessionWarningMinutes: number;
}

const DEFAULT_CONFIG: AdminSecurityConfig = {
  // Rate Limiting defaults
  apiRateLimitRequests: 60,
  apiRateLimitWindowMs: 60000,
  loginRateLimitAttempts: 5,
  loginRateLimitWindowSeconds: 60,
  
  // Auto-blocking defaults
  autoBlockEnabled: true,
  autoBlockDurationHours: 24,
  autoBlockMinConfidence: 70,
  
  // CAPTCHA defaults
  captchaEnabled: false,
  captchaProvider: null,
  captchaThreshold: 0.5,
  
  // Session defaults
  sessionTimeoutMinutes: 30,
  sessionWarningMinutes: 2,
};

// Cache configuration for 5 minutes
let cachedConfig: AdminSecurityConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get admin security configuration from database
 * Results are cached for 5 minutes to reduce database queries
 */
export async function getAdminSecurityConfig(): Promise<AdminSecurityConfig> {
  // Return cached config if still valid
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedConfig;
  }
  
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Admin Security Config] Service role key not configured, using defaults');
      return DEFAULT_CONFIG;
    }
    
    const supabase = getAdminClient();
    
    const { data, error } = await supabase
      .from('security_settings')
      .select(`
        api_rate_limit_requests,
        api_rate_limit_window_ms,
        login_rate_limit_attempts,
        login_rate_limit_window_seconds,
        auto_block_enabled,
        auto_block_duration_hours,
        auto_block_min_confidence,
        captcha_enabled,
        captcha_provider,
        captcha_threshold,
        session_timeout_minutes,
        session_warning_minutes
      `)
      .single();
    
    if (error || !data) {
      // console.warn('[Admin Security Config] Failed to fetch config, using defaults:', error);
      return DEFAULT_CONFIG;
    }
    
    // Build config from database with fallbacks
    const config: AdminSecurityConfig = {
      apiRateLimitRequests: data.api_rate_limit_requests ?? DEFAULT_CONFIG.apiRateLimitRequests,
      apiRateLimitWindowMs: data.api_rate_limit_window_ms ?? DEFAULT_CONFIG.apiRateLimitWindowMs,
      loginRateLimitAttempts: data.login_rate_limit_attempts ?? DEFAULT_CONFIG.loginRateLimitAttempts,
      loginRateLimitWindowSeconds: data.login_rate_limit_window_seconds ?? DEFAULT_CONFIG.loginRateLimitWindowSeconds,
      autoBlockEnabled: data.auto_block_enabled ?? DEFAULT_CONFIG.autoBlockEnabled,
      autoBlockDurationHours: data.auto_block_duration_hours ?? DEFAULT_CONFIG.autoBlockDurationHours,
      autoBlockMinConfidence: data.auto_block_min_confidence ?? DEFAULT_CONFIG.autoBlockMinConfidence,
      captchaEnabled: data.captcha_enabled ?? DEFAULT_CONFIG.captchaEnabled,
      captchaProvider: data.captcha_provider ?? DEFAULT_CONFIG.captchaProvider,
      captchaThreshold: data.captcha_threshold ?? DEFAULT_CONFIG.captchaThreshold,
      sessionTimeoutMinutes: data.session_timeout_minutes ?? DEFAULT_CONFIG.sessionTimeoutMinutes,
      sessionWarningMinutes: data.session_warning_minutes ?? DEFAULT_CONFIG.sessionWarningMinutes,
    };
    
    // Update cache
    cachedConfig = config;
    cacheTimestamp = now;
    
    return config;
  } catch (error) {
    console.error('[Admin Security Config] Error fetching config:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Invalidate the configuration cache
 * Call this when security settings are updated in the admin panel
 */
export function invalidateAdminSecurityConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Check if an IP address is blocked
 */
export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return false;
    }
    
    const supabase = getAdminClient();
    
    const { data, error } = await supabase
      .from('blocked_ips')
      .select('id')
      .eq('ip_address', ipAddress)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();
    
    if (error) {
      console.error('[Admin Security Config] Error checking blocked IP:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('[Admin Security Config] Error in isIpBlocked:', error);
    return false;
  }
}

