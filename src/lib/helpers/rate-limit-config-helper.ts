/**
 * Rate Limit Configuration Helper
 * 
 * Provides cached access to rate limiting configuration from the database.
 * Falls back to environment variables if database is not available.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { redisCache } from '@/lib/redis';

interface RateLimitConfig {
  apiRateLimitRequests: number;
  apiRateLimitWindowMs: number;
  loginRateLimitAttempts: number;
  loginRateLimitWindowSeconds: number;
  autoBlockEnabled: boolean;
  autoBlockDurationHours: number;
  autoBlockMinConfidence: number;
}

const CACHE_KEY = 'security:rate_limit_config';
const CACHE_TTL = 300; // 5 minutes

/**
 * Default configuration (fallback values)
 * In production, these are secure defaults that don't depend on environment variables
 * In development, environment variables can override these for testing
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  apiRateLimitRequests: 60,
  apiRateLimitWindowMs: 60000,
  loginRateLimitAttempts: 5,
  loginRateLimitWindowSeconds: 60,
  autoBlockEnabled: true,
  autoBlockDurationHours: 24,
  autoBlockMinConfidence: 70,
};

/**
 * Get rate limit configuration from environment variables
 *
 * SECURITY POLICY:
 * - In PRODUCTION: Always use secure defaults (ignore environment variables for security settings)
 * - In DEVELOPMENT: Allow environment variables for testing flexibility
 *
 * This ensures production is secure by default, even if environment variables are misconfigured
 */
function getConfigFromEnv(): RateLimitConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    // Rate limiting can be configured via env vars in both dev and prod
    apiRateLimitRequests: process.env.API_RATE_LIMIT_REQUESTS
      ? parseInt(process.env.API_RATE_LIMIT_REQUESTS, 10)
      : DEFAULT_CONFIG.apiRateLimitRequests,
    apiRateLimitWindowMs: process.env.API_RATE_LIMIT_WINDOW_MS
      ? parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10)
      : DEFAULT_CONFIG.apiRateLimitWindowMs,
    loginRateLimitAttempts: process.env.LOGIN_RATE_LIMIT_ATTEMPTS
      ? parseInt(process.env.LOGIN_RATE_LIMIT_ATTEMPTS, 10)
      : DEFAULT_CONFIG.loginRateLimitAttempts,
    loginRateLimitWindowSeconds: process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS
      ? parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS, 10)
      : DEFAULT_CONFIG.loginRateLimitWindowSeconds,

    // SECURITY: In production, always use secure defaults (ignore env vars)
    // In development, allow env vars for testing
    autoBlockEnabled: isProduction
      ? DEFAULT_CONFIG.autoBlockEnabled // Always true in production
      : (process.env.AUTO_BLOCK_ENABLED !== 'false'), // Can be disabled in dev
    autoBlockDurationHours: isProduction
      ? DEFAULT_CONFIG.autoBlockDurationHours // Always 24h in production
      : (process.env.AUTO_BLOCK_DURATION_HOURS
          ? parseInt(process.env.AUTO_BLOCK_DURATION_HOURS, 10)
          : DEFAULT_CONFIG.autoBlockDurationHours),
    autoBlockMinConfidence: isProduction
      ? DEFAULT_CONFIG.autoBlockMinConfidence // Always 70 in production
      : (process.env.AUTO_BLOCK_MIN_CONFIDENCE
          ? parseInt(process.env.AUTO_BLOCK_MIN_CONFIDENCE, 10)
          : DEFAULT_CONFIG.autoBlockMinConfidence),
  };
}

/**
 * Fetch rate limit configuration from database
 */
async function fetchConfigFromDatabase(): Promise<RateLimitConfig | null> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return null;
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('security_settings')
      .select(
        'api_rate_limit_requests, api_rate_limit_window_ms, login_rate_limit_attempts, login_rate_limit_window_seconds, auto_block_enabled, auto_block_duration_hours, auto_block_min_confidence'
      )
      .single();

    if (error || !data) {
      return null;
    }

    return {
      apiRateLimitRequests: data.api_rate_limit_requests ?? DEFAULT_CONFIG.apiRateLimitRequests,
      apiRateLimitWindowMs: data.api_rate_limit_window_ms ?? DEFAULT_CONFIG.apiRateLimitWindowMs,
      loginRateLimitAttempts: data.login_rate_limit_attempts ?? DEFAULT_CONFIG.loginRateLimitAttempts,
      loginRateLimitWindowSeconds: data.login_rate_limit_window_seconds ?? DEFAULT_CONFIG.loginRateLimitWindowSeconds,
      autoBlockEnabled: data.auto_block_enabled ?? DEFAULT_CONFIG.autoBlockEnabled,
      autoBlockDurationHours: data.auto_block_duration_hours ?? DEFAULT_CONFIG.autoBlockDurationHours,
      autoBlockMinConfidence: data.auto_block_min_confidence ?? DEFAULT_CONFIG.autoBlockMinConfidence,
    };
  } catch (error) {
    console.error('[RateLimitConfig] Error fetching from database:', error);
    return null;
  }
}

/**
 * Get cached rate limit configuration
 * 
 * Priority:
 * 1. Database configuration (cached)
 * 2. Environment variables
 * 3. Default values
 */
export async function getRateLimitConfig(): Promise<RateLimitConfig> {
  // Try to get from Redis cache first
  if (redisCache.isAvailable()) {
    try {
      const cached = await redisCache.get<RateLimitConfig>(CACHE_KEY);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.error('[RateLimitConfig] Error reading from cache:', error);
    }
  }

  // Try to fetch from database
  const dbConfig = await fetchConfigFromDatabase();
  
  if (dbConfig) {
    // Cache the result
    if (redisCache.isAvailable()) {
      try {
        await redisCache.set(CACHE_KEY, dbConfig, CACHE_TTL);
      } catch (error) {
        console.error('[RateLimitConfig] Error writing to cache:', error);
      }
    }
    return dbConfig;
  }

  // Fallback to environment variables
  const envConfig = getConfigFromEnv();
  
  // Cache the env config too (shorter TTL)
  if (redisCache.isAvailable()) {
    try {
      await redisCache.set(CACHE_KEY, envConfig, 60); // 1 minute cache for env fallback
    } catch (error) {
      console.error('[RateLimitConfig] Error writing env config to cache:', error);
    }
  }

  return envConfig;
}

/**
 * Invalidate the rate limit configuration cache
 * Call this after updating the configuration in the database
 */
export async function invalidateRateLimitConfigCache(): Promise<void> {
  if (redisCache.isAvailable()) {
    try {
      await redisCache.delete(CACHE_KEY);
    } catch (error) {
      console.error('[RateLimitConfig] Error invalidating cache:', error);
    }
  }
}

