import type { RateLimitResult, RateLimiter } from '../../domain/contracts/rate-limiter';

export interface InMemoryFixedWindowRateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

type Bucket = {
  count: number;
  windowStart: number;
};

export class InMemoryFixedWindowRateLimiter implements RateLimiter {
  private readonly store = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: InMemoryFixedWindowRateLimiterOptions) {
    if (options.limit <= 0) {
      throw new Error('Rate limit must be greater than zero.');
    }

    if (options.windowMs <= 0) {
      throw new Error('Rate limit window must be greater than zero.');
    }

    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
  }

  async consume(key: string): Promise<RateLimitResult> {
    const timestamp = this.now();
    const bucket = this.getBucket(key, timestamp);
    bucket.count += 1;
    this.store.set(key, bucket);

    const allowed = bucket.count <= this.limit;
    const remaining = allowed ? this.limit - bucket.count : 0;
    const resetAt = bucket.windowStart + this.windowMs;
    const retryAfterMs = Math.max(0, resetAt - timestamp);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return {
      allowed,
      limit: this.limit,
      remaining,
      resetAt,
      retryAfterSeconds,
    };
  }

  private getBucket(key: string, timestamp: number): Bucket {
    const existing = this.store.get(key);

    if (!existing) {
      return { count: 0, windowStart: timestamp };
    }

    if (timestamp >= existing.windowStart + this.windowMs) {
      return { count: 0, windowStart: timestamp };
    }

    return existing;
  }
}
