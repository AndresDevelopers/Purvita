import type { RateLimitResult } from '../contracts/rate-limiter';

export class RateLimitExceededError extends Error {
  constructor(public readonly result: RateLimitResult) {
    super('Rate limit exceeded');
    this.name = 'RateLimitExceededError';
  }
}
