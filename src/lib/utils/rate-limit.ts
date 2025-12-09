/**
 * Rate Limiting Utility using Upstash Redis
 * 
 * Provides rate limiting functionality for API routes and server actions.
 * Falls back to in-memory tracking if Redis is not available.
 * 
 * @example
 * ```typescript
 * import { rateLimit } from '@/lib/utils/rate-limit';
 * 
 * export async function POST(_request: Request) {
 *   const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
 *   
 *   const { success, remaining, reset } = await rateLimit(identifier, {
 *     limit: 10,
 *     window: 60, // 60 seconds
 *   });
 *   
 *   if (!success) {
 *     return new Response('Too many requests', { 
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': '10',
 *         'X-RateLimit-Remaining': '0',
 *         'X-RateLimit-Reset': reset.toString(),
 *       }
 *     });
 *   }
 *   
 *   // Process request...
 * }
 * ```
 */

import { redisCache, CacheKeys as _CacheKeys } from '@/lib/redis';

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed in the time window
   * @default 60
   */
  limit?: number;

  /**
   * Time window in seconds
   * @default 60
   */
  window?: number;

  /**
   * Custom prefix for the rate limit key
   * @default 'ratelimit'
   */
  prefix?: string;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  success: boolean;

  /**
   * Number of requests remaining in the current window
   */
  remaining: number;

  /**
   * Timestamp when the rate limit resets (Unix timestamp in seconds)
   */
  reset: number;

  /**
   * Total limit for the window
   */
  limit: number;
}

// In-memory fallback for when Redis is not available
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired entries from in-memory store
 */
function cleanupInMemoryStore() {
  const now = Date.now();
  for (const [key, value] of inMemoryStore.entries()) {
    if (now > value.resetAt) {
      inMemoryStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupInMemoryStore, 5 * 60 * 1000);
}

/**
 * Rate limit using in-memory storage (fallback)
 */
async function rateLimitInMemory(
  identifier: string,
  options: Required<RateLimitOptions>
): Promise<RateLimitResult> {
  const key = `${options.prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = options.window * 1000;

  const entry = inMemoryStore.get(key);

  // No entry or expired
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    inMemoryStore.set(key, { count: 1, resetAt });
    
    return {
      success: true,
      remaining: options.limit - 1,
      reset: Math.floor(resetAt / 1000),
      limit: options.limit,
    };
  }

  // Increment counter
  entry.count++;

  const success = entry.count <= options.limit;
  const remaining = Math.max(0, options.limit - entry.count);

  return {
    success,
    remaining,
    reset: Math.floor(entry.resetAt / 1000),
    limit: options.limit,
  };
}

/**
 * Rate limit using Redis
 */
async function rateLimitRedis(
  identifier: string,
  options: Required<RateLimitOptions>
): Promise<RateLimitResult> {
  const key = `${options.prefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + options.window;

  // Try to get current count
  const currentCount = await redisCache.get<number>(key);

  if (currentCount === null) {
    // First request in this window
    await redisCache.set(key, 1, options.window);
    
    return {
      success: true,
      remaining: options.limit - 1,
      reset: resetAt,
      limit: options.limit,
    };
  }

  // Increment counter
  const newCount = await redisCache.increment(key);

  if (newCount === null) {
    // Redis error, fall back to allowing the request
    console.warn('[RateLimit] Redis increment failed, allowing request');
    return {
      success: true,
      remaining: options.limit - 1,
      reset: resetAt,
      limit: options.limit,
    };
  }

  const success = newCount <= options.limit;
  const remaining = Math.max(0, options.limit - newCount);

  return {
    success,
    remaining,
    reset: resetAt,
    limit: options.limit,
  };
}

/**
 * Rate limit a request based on an identifier
 * 
 * @param identifier Unique identifier for the rate limit (e.g., user ID, IP address)
 * @param options Rate limit configuration
 * @returns Rate limit result
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const config: Required<RateLimitOptions> = {
    limit: options.limit ?? 60,
    window: options.window ?? 60,
    prefix: options.prefix ?? 'ratelimit',
  };

  // Use Redis if available, otherwise fall back to in-memory
  if (redisCache.isAvailable()) {
    return rateLimitRedis(identifier, config);
  } else {
    return rateLimitInMemory(identifier, config);
  }
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
  /**
   * Strict rate limit for sensitive operations (e.g., login, password reset)
   * 5 requests per minute
   */
  strict: { limit: 5, window: 60 },

  /**
   * Standard rate limit for API endpoints
   * 60 requests per minute
   */
  standard: { limit: 60, window: 60 },

  /**
   * Generous rate limit for public endpoints
   * 100 requests per minute
   */
  generous: { limit: 100, window: 60 },

  /**
   * Webhook rate limit for payment provider webhooks
   * 200 requests per minute (allows burst traffic from payment providers)
   * Uses 'webhook' prefix to separate from general API limits
   */
  webhook: { limit: 200, window: 60, prefix: 'webhook' },

  /**
   * Hourly rate limit for resource-intensive operations
   * 100 requests per hour
   */
  hourly: { limit: 100, window: 3600 },

  /**
   * Daily rate limit for bulk operations
   * 1000 requests per day
   */
  daily: { limit: 1000, window: 86400 },
} as const;

/**
 * Middleware helper for Next.js API routes
 */
export async function withRateLimit(
  request: Request,
  options: RateLimitOptions = {}
): Promise<Response | null> {
  // Get identifier from request (IP address or user ID)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';
  
  const result = await rateLimit(ip, options);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: result.reset,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getRateLimitHeaders(result),
          'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString(),
        },
      }
    );
  }

  // Request is allowed, return null to continue
  return null;
}

