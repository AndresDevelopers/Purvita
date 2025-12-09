import type { Locale } from '@/i18n/config';

import type { RateLimitResult, RateLimiter } from '../domain/contracts/rate-limiter';
import { RateLimitExceededError } from '../domain/errors/rate-limit-exceeded-error';
import { getRequestFingerprint } from '../domain/utils/request-fingerprint';

const RATE_LIMIT_MESSAGES: Record<Locale, string> = {
  en: 'Too many requests. Please try again in a few moments.',
  es: 'Demasiadas solicitudes. Vuelve a intentarlo en unos momentos.',
};

export interface RateLimitServiceDependencies {
  limiter: RateLimiter;
}

export interface RateLimitGuardResult {
  locale: Locale;
  result: RateLimitResult;
}

export class RateLimitService {
  constructor(private readonly dependencies: RateLimitServiceDependencies) {}

  async guard(request: Request, scope: string): Promise<RateLimitGuardResult> {
    const { fingerprint, locale } = getRequestFingerprint(request);
    const key = `${scope}:${fingerprint}`;
    const result = await this.dependencies.limiter.consume(key);

    return { locale, result };
  }

  ensureAllowed(result: RateLimitResult) {
    if (!result.allowed) {
      throw new RateLimitExceededError(result);
    }
  }

  buildHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    };

    if (!result.allowed) {
      headers['Retry-After'] = Math.max(0, result.retryAfterSeconds).toString();
    }

    return headers;
  }

  applyHeaders(response: Response, result: RateLimitResult): Response {
    const headers = this.buildHeaders(result);

    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  buildErrorPayload(locale: Locale) {
    return {
      error: RATE_LIMIT_MESSAGES.en,
      error_es: RATE_LIMIT_MESSAGES.es,
      message: RATE_LIMIT_MESSAGES[locale] ?? RATE_LIMIT_MESSAGES.en,
    };
  }
}
