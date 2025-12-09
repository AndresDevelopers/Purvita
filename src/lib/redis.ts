/**
 * Upstash Redis Configuration
 * 
 * This module provides a singleton Redis client for caching and session management.
 * Uses Upstash Redis for serverless-friendly, edge-compatible caching.
 * 
 * Features:
 * - Automatic connection management
 * - Type-safe operations
 * - Error handling with fallback
 * - Support for TTL (Time To Live)
 * 
 * @see https://upstash.com/docs/redis/overall/getstarted
 */

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;
let hasWarned = false;

/**
 * Get or create Redis client instance
 * Returns null if Redis is not configured (graceful degradation)
 *
 * Redis is ONLY enabled in production (NODE_ENV=production)
 * In development, it always returns null to avoid unnecessary connections
 */
export function getRedisClient(): Redis | null {
  // Return existing client if available
  if (redisClient) {
    return redisClient;
  }

  // ONLY enable Redis in production
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    if (!hasWarned) {
      console.log('[Redis] Redis is disabled in development mode. Using in-memory fallback.');
      hasWarned = true;
    }
    return null;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Check if Redis is configured
  if (!redisUrl || !redisToken) {
    if (!hasWarned) {
      console.warn(
        '[Redis] Upstash Redis is not configured. Caching will be disabled. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
      );
      hasWarned = true;
    }
    return null;
  }

  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    console.log('[Redis] Successfully connected to Upstash Redis');
    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Redis Cache Helper
 * Provides convenient methods for common caching operations
 */
export class RedisCache {
  private client: Redis | null;

  constructor() {
    this.client = getRedisClient();
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if not found or Redis unavailable
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      const value = await this.client.get<T>(key);
      return value;
    } catch (error) {
      console.error(`[Redis] Error getting key "${key}":`, error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds Time to live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`[Redis] Error setting key "${key}":`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param key Cache key
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] Error deleting key "${key}":`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern Key pattern (e.g., "user:*")
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      console.error(`[Redis] Error deleting pattern "${pattern}":`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param key Cache key
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Error checking existence of key "${key}":`, error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch if not in cache
   * @param key Cache key
   * @param fetcher Function to fetch data if not cached
   * @param ttlSeconds Time to live in seconds (optional)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();
    
    // Store in cache (fire and forget)
    this.set(key, data, ttlSeconds).catch((error) => {
      console.error(`[Redis] Failed to cache key "${key}":`, error);
    });

    return data;
  }

  /**
   * Increment a counter
   * @param key Counter key
   * @param amount Amount to increment (default: 1)
   */
  async increment(key: string, amount: number = 1): Promise<number | null> {
    if (!this.client) {
      return null;
    }

    try {
      const result = await this.client.incrby(key, amount);
      return result;
    } catch (error) {
      console.error(`[Redis] Error incrementing key "${key}":`, error);
      return null;
    }
  }

  /**
   * Set expiration time for a key
   * @param key Cache key
   * @param ttlSeconds Time to live in seconds
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error(`[Redis] Error setting expiration for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param key Cache key
   * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist, null on error
   */
  async ttl(key: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }

    try {
      const result = await this.client.ttl(key);
      return result;
    } catch (error) {
      console.error(`[Redis] Error getting TTL for key "${key}":`, error);
      return null;
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache();

/**
 * Cache key generators for consistent naming
 */
export const CacheKeys = {
  appSettings: () => 'app:settings',
  phaseLevels: () => 'app:phase-levels',
  user: (userId: string) => `user:${userId}`,
  userProfile: (userId: string) => `user:${userId}:profile`,
  userWallet: (userId: string) => `user:${userId}:wallet`,
  userTeam: (userId: string) => `user:${userId}:team`,
  product: (productId: string) => `product:${productId}`,
  products: () => 'products:all',
  translation: (locale: string, namespace: string) => `i18n:${locale}:${namespace}`,
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
} as const;

