/**
 * Admin Rate Limiter
 *
 * Implements stricter rate limiting for admin endpoints
 * to prevent abuse and brute force attacks.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting (consider using Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Admin-specific rate limits (stricter than regular API)
const ADMIN_RATE_LIMITS = {
  // General admin API: 30 requests per minute
  api: {
    requests: 30,
    windowMs: 60 * 1000,
  },

  // Admin login: 3 attempts per 5 minutes
  login: {
    requests: 3,
    windowMs: 5 * 60 * 1000,
  },

  // Security settings: 10 requests per hour
  security: {
    requests: 10,
    windowMs: 60 * 60 * 1000,
  },

  // User management: 20 requests per minute
  users: {
    requests: 20,
    windowMs: 60 * 1000,
  },

  // Payment operations: 15 requests per minute
  payments: {
    requests: 15,
    windowMs: 60 * 1000,
  },
} as const;

export type AdminRateLimitType = keyof typeof ADMIN_RATE_LIMITS;

/**
 * Check if request should be rate limited
 * Returns true if rate limit exceeded, false otherwise
 */
export async function isAdminRateLimited(
  identifier: string,
  type: AdminRateLimitType = 'api'
): Promise<boolean> {
  const limit = ADMIN_RATE_LIMITS[type];
  const key = `admin:${type}:${identifier}`;
  const now = Date.now();

  // Clean up expired entries periodically
  cleanupExpiredEntries();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + limit.windowMs,
    });
    return false;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > limit.requests) {
    return true;
  }

  return false;
}

/**
 * Get remaining requests for an identifier
 */
export function getAdminRateLimitRemaining(
  identifier: string,
  type: AdminRateLimitType = 'api'
): number {
  const limit = ADMIN_RATE_LIMITS[type];
  const key = `admin:${type}:${identifier}`;
  const entry = rateLimitStore.get(key);
  const now = Date.now();

  if (!entry || now > entry.resetAt) {
    return limit.requests;
  }

  return Math.max(0, limit.requests - entry.count);
}

/**
 * Reset rate limit for an identifier
 */
export function resetAdminRateLimit(
  identifier: string,
  type: AdminRateLimitType = 'api'
): void {
  const key = `admin:${type}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Clean up expired entries from the store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  // Find expired entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      expiredKeys.push(key);
    }
  }

  // Remove expired entries
  for (const key of expiredKeys) {
    rateLimitStore.delete(key);
  }
}

/**
 * Middleware helper for admin routes
 * Returns error response if rate limited
 */
export async function checkAdminRateLimit(
  request: Request,
  type: AdminRateLimitType = 'api'
): Promise<Response | null> {
  // Get identifier (IP address or user ID)
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const identifier = ipAddress;

  // Check rate limit
  const isLimited = await isAdminRateLimited(identifier, type);

  if (isLimited) {
    const remaining = getAdminRateLimitRemaining(identifier, type);
    const limit = ADMIN_RATE_LIMITS[type];

    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again later.`,
        retryAfter: Math.ceil(limit.windowMs / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(limit.windowMs / 1000)),
          'X-RateLimit-Limit': String(limit.requests),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(Date.now() + limit.windowMs),
        },
      }
    );
  }

  return null;
}

/**
 * Get rate limit info for headers
 */
export function getAdminRateLimitHeaders(
  identifier: string,
  type: AdminRateLimitType = 'api'
): Record<string, string> {
  const limit = ADMIN_RATE_LIMITS[type];
  const remaining = getAdminRateLimitRemaining(identifier, type);

  return {
    'X-RateLimit-Limit': String(limit.requests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Window': String(limit.windowMs),
  };
}
