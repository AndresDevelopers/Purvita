import { supabase } from '@/lib/supabase';

import { InMemoryFixedWindowRateLimiter } from '../data/rate-limiter/in-memory-fixed-window-rate-limiter';
import { SupabaseSessionRepository, type SupabaseSessionRepositoryDependencies } from '../data/repositories/supabase-session-repository';
import type { SessionRepository } from '../domain/contracts/session-repository';
import type { RateLimiter } from '../domain/contracts/rate-limiter';
import { RateLimitService } from '../services/rate-limit-service';

export interface SecurityModule {
  sessionRepository: SessionRepository;
  rateLimitService: RateLimitService;
}

const createDefaultDependencies = (): SupabaseSessionRepositoryDependencies => {
  return {
    client: supabase,
  };
};

const _parseIntegerEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createDefaultRateLimiter = (): RateLimiter => {
  if (typeof window !== 'undefined') {
    return new InMemoryFixedWindowRateLimiter({ limit: 60, windowMs: 60_000 });
  }

  try {
    const { env } = require('@/lib/env');
    const limit = env.API_RATE_LIMIT_REQUESTS ?? 60;
    const windowMs = env.API_RATE_LIMIT_WINDOW_MS ?? 60_000;
    return new InMemoryFixedWindowRateLimiter({ limit, windowMs });
  } catch {
    // Fallback if env validation fails
    return new InMemoryFixedWindowRateLimiter({ limit: 60, windowMs: 60_000 });
  }
};

export interface SecurityModuleOverrides {
  sessionRepository?: SessionRepository;
  sessionRepositoryDependencies?: Partial<SupabaseSessionRepositoryDependencies>;
  rateLimiter?: RateLimiter;
}

export const createSecurityModule = (
  overrides: SecurityModuleOverrides = {},
): SecurityModule => {
  const defaults = createDefaultDependencies();

  const dependencies: SupabaseSessionRepositoryDependencies = {
    client: overrides.sessionRepositoryDependencies?.client ?? defaults.client,
  };

  const sessionRepository =
    overrides.sessionRepository ?? new SupabaseSessionRepository(dependencies);

  const rateLimiter = overrides.rateLimiter ?? createDefaultRateLimiter();
  const rateLimitService = new RateLimitService({ limiter: rateLimiter });

  return { sessionRepository, rateLimitService };
};