import { describe, expect, it } from 'vitest';

import { InMemoryFixedWindowRateLimiter } from '../../data/rate-limiter/in-memory-fixed-window-rate-limiter';

describe('InMemoryFixedWindowRateLimiter', () => {
  it('permits requests within the window limit', async () => {
    let now = 1_000;
    const limiter = new InMemoryFixedWindowRateLimiter({
      limit: 2,
      windowMs: 1_000,
      now: () => now,
    });

    const first = await limiter.consume('ip-1');
    const second = await limiter.consume('ip-1');

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it('blocks requests that exceed the limit until the window resets', async () => {
    let now = 1_000;
    const limiter = new InMemoryFixedWindowRateLimiter({
      limit: 2,
      windowMs: 1_000,
      now: () => now,
    });

    await limiter.consume('ip-1');
    await limiter.consume('ip-1');
    const denied = await limiter.consume('ip-1');

    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);

    now += 1_001;

    const afterReset = await limiter.consume('ip-1');
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });
});
