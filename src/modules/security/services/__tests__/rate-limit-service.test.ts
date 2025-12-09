import { describe, expect, it, beforeEach, vi } from 'vitest'
import { RateLimitService, type RateLimitServiceDependencies } from '../rate-limit-service'
import { RateLimitExceededError } from '../../domain/errors/rate-limit-exceeded-error'
import type { RateLimiter, RateLimitResult } from '../../domain/contracts/rate-limiter'

// Mock the request fingerprint utility
vi.mock('../../domain/utils/request-fingerprint', () => ({
  getRequestFingerprint: vi.fn((request: Request) => {
    const url = new URL(request.url)
    const locale = url.searchParams.get('locale') || 'en'
    return {
      fingerprint: 'test-fingerprint-123',
      locale: locale as 'en' | 'es'
    }
  })
}))

describe('RateLimitService', () => {
  let service: RateLimitService
  let mockLimiter: RateLimiter
  let mockRequest: Request

  beforeEach(() => {
    mockLimiter = {
      consume: vi.fn()
    }

    const dependencies: RateLimitServiceDependencies = {
      limiter: mockLimiter
    }

    service = new RateLimitService(dependencies)
    mockRequest = new Request('https://example.com/api/test')
  })

  describe('guard', () => {
    it('should call limiter with scoped key', async () => {
      const mockResult: RateLimitResult = {
        allowed: true,
        limit: 10,
        remaining: 9,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 0
      }

      vi.mocked(mockLimiter.consume).mockResolvedValue(mockResult)

      const result = await service.guard(mockRequest, 'api:login')

      expect(mockLimiter.consume).toHaveBeenCalledWith('api:login:test-fingerprint-123')
      expect(result.locale).toBe('en')
      expect(result.result).toEqual(mockResult)
    })

    it('should return result with locale from request', async () => {
      const mockResult: RateLimitResult = {
        allowed: true,
        limit: 10,
        remaining: 9,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 0
      }

      vi.mocked(mockLimiter.consume).mockResolvedValue(mockResult)
      const spanishRequest = new Request('https://example.com/api/test?locale=es')

      const result = await service.guard(spanishRequest, 'api:register')

      expect(result.locale).toBe('es')
    })

    it('should handle rate limit exceeded', async () => {
      const mockResult: RateLimitResult = {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 60
      }

      vi.mocked(mockLimiter.consume).mockResolvedValue(mockResult)

      const result = await service.guard(mockRequest, 'api:sensitive')

      expect(result.result.allowed).toBe(false)
      expect(result.result.remaining).toBe(0)
    })
  })

  describe('ensureAllowed', () => {
    it('should not throw when rate limit is allowed', () => {
      const result: RateLimitResult = {
        allowed: true,
        limit: 10,
        remaining: 5,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 0
      }

      expect(() => service.ensureAllowed(result)).not.toThrow()
    })

    it('should throw RateLimitExceededError when rate limit is exceeded', () => {
      const result: RateLimitResult = {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 60
      }

      expect(() => service.ensureAllowed(result)).toThrow(RateLimitExceededError)
    })
  })

  describe('buildHeaders', () => {
    it('should build rate limit headers when allowed', () => {
      const resetAt = Date.now() + 60000
      const result: RateLimitResult = {
        allowed: true,
        limit: 100,
        remaining: 75,
        resetAt,
        retryAfterSeconds: 0
      }

      const headers = service.buildHeaders(result)

      expect(headers['X-RateLimit-Limit']).toBe('100')
      expect(headers['X-RateLimit-Remaining']).toBe('75')
      expect(headers['X-RateLimit-Reset']).toBe(Math.ceil(resetAt / 1000).toString())
      expect(headers['Retry-After']).toBeUndefined()
    })

    it('should include Retry-After header when rate limit exceeded', () => {
      const result: RateLimitResult = {
        allowed: false,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 45
      }

      const headers = service.buildHeaders(result)

      expect(headers['X-RateLimit-Limit']).toBe('100')
      expect(headers['X-RateLimit-Remaining']).toBe('0')
      expect(headers['Retry-After']).toBe('45')
    })

    it('should handle negative remaining as zero', () => {
      const result: RateLimitResult = {
        allowed: false,
        limit: 100,
        remaining: -5,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 30
      }

      const headers = service.buildHeaders(result)

      expect(headers['X-RateLimit-Remaining']).toBe('0')
    })

    it('should handle negative retryAfterSeconds as zero', () => {
      const result: RateLimitResult = {
        allowed: false,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() - 1000,
        retryAfterSeconds: -10
      }

      const headers = service.buildHeaders(result)

      expect(headers['Retry-After']).toBe('0')
    })

    it('should convert resetAt from milliseconds to seconds', () => {
      const resetAtMs = 1700000000000 // Example timestamp in milliseconds
      const result: RateLimitResult = {
        allowed: true,
        limit: 50,
        remaining: 25,
        resetAt: resetAtMs,
        retryAfterSeconds: 0
      }

      const headers = service.buildHeaders(result)

      expect(headers['X-RateLimit-Reset']).toBe(Math.ceil(resetAtMs / 1000).toString())
    })
  })

  describe('applyHeaders', () => {
    it('should apply rate limit headers to response', () => {
      const response = new Response('OK', { status: 200 })
      const result: RateLimitResult = {
        allowed: true,
        limit: 100,
        remaining: 90,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 0
      }

      const updatedResponse = service.applyHeaders(response, result)

      expect(updatedResponse.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(updatedResponse.headers.get('X-RateLimit-Remaining')).toBe('90')
      expect(updatedResponse.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })

    it('should apply Retry-After header when rate limit exceeded', () => {
      const response = new Response('Rate limit exceeded', { status: 429 })
      const result: RateLimitResult = {
        allowed: false,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 30
      }

      const updatedResponse = service.applyHeaders(response, result)

      expect(updatedResponse.headers.get('Retry-After')).toBe('30')
      expect(updatedResponse.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('should return the same response object with modified headers', () => {
      const response = new Response('OK')
      const result: RateLimitResult = {
        allowed: true,
        limit: 10,
        remaining: 5,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 0
      }

      const updatedResponse = service.applyHeaders(response, result)

      expect(updatedResponse).toBe(response)
    })
  })

  describe('buildErrorPayload', () => {
    it('should build error payload for English locale', () => {
      const payload = service.buildErrorPayload('en')

      expect(payload.error).toBe('Too many requests. Please try again in a few moments.')
      expect(payload.error_es).toBe('Demasiadas solicitudes. Vuelve a intentarlo en unos momentos.')
      expect(payload.message).toBe('Too many requests. Please try again in a few moments.')
    })

    it('should build error payload for Spanish locale', () => {
      const payload = service.buildErrorPayload('es')

      expect(payload.error).toBe('Too many requests. Please try again in a few moments.')
      expect(payload.error_es).toBe('Demasiadas solicitudes. Vuelve a intentarlo en unos momentos.')
      expect(payload.message).toBe('Demasiadas solicitudes. Vuelve a intentarlo en unos momentos.')
    })

    it('should fallback to English for unsupported locale', () => {
      // @ts-expect-error - testing with invalid locale
      const payload = service.buildErrorPayload('fr')

      expect(payload.message).toBe('Too many requests. Please try again in a few moments.')
    })

    it('should always include both English and Spanish messages', () => {
      const enPayload = service.buildErrorPayload('en')
      const esPayload = service.buildErrorPayload('es')

      expect(enPayload.error).toBe(esPayload.error)
      expect(enPayload.error_es).toBe(esPayload.error_es)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete rate limiting flow', async () => {
      const mockResult: RateLimitResult = {
        allowed: true,
        limit: 10,
        remaining: 9,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 0
      }

      vi.mocked(mockLimiter.consume).mockResolvedValue(mockResult)

      // Guard the request
      const guardResult = await service.guard(mockRequest, 'api:test')

      // Ensure it's allowed
      expect(() => service.ensureAllowed(guardResult.result)).not.toThrow()

      // Build headers
      const headers = service.buildHeaders(guardResult.result)
      expect(headers['X-RateLimit-Limit']).toBe('10')
      expect(headers['X-RateLimit-Remaining']).toBe('9')
    })

    it('should handle rate limit exceeded scenario', async () => {
      const mockResult: RateLimitResult = {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfterSeconds: 60
      }

      vi.mocked(mockLimiter.consume).mockResolvedValue(mockResult)

      // Guard the request
      const guardResult = await service.guard(mockRequest, 'api:test')

      // Should throw when checking if allowed
      expect(() => service.ensureAllowed(guardResult.result)).toThrow(RateLimitExceededError)

      // Build error payload
      const errorPayload = service.buildErrorPayload(guardResult.locale)
      expect(errorPayload.message).toBeTruthy()

      // Build headers including Retry-After
      const headers = service.buildHeaders(guardResult.result)
      expect(headers['Retry-After']).toBe('60')
    })
  })
})
