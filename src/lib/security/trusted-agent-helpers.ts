import type { NextRequest } from 'next/server'

/**
 * Trusted Agent Helpers
 * 
 * Helper functions to check if a request comes from a trusted agent
 * and what protections should be bypassed.
 */

/**
 * Check if request is from a trusted agent
 */
export function isTrustedAgent(request: NextRequest): boolean {
  return request.headers.get('x-trusted-agent') === 'true'
}

/**
 * Check if CAPTCHA should be bypassed for this request
 */
export function shouldBypassCaptcha(request: NextRequest): boolean {
  return request.headers.get('x-bypass-captcha') === 'true'
}

/**
 * Check if rate limiting should be bypassed for this request
 */
export function shouldBypassRateLimiting(request: NextRequest): boolean {
  return request.headers.get('x-bypass-rate-limiting') === 'true'
}

/**
 * Check if CSRF should be bypassed for this request
 */
export function shouldBypassCsrf(request: NextRequest): boolean {
  return request.headers.get('x-bypass-csrf') === 'true'
}

/**
 * Check if CSP should be bypassed for this request
 */
export function shouldBypassCsp(request: NextRequest): boolean {
  return request.headers.get('x-bypass-csp') === 'true'
}

/**
 * Get all bypass flags for a request
 */
export function getTrustedAgentBypassFlags(request: NextRequest) {
  return {
    isTrusted: isTrustedAgent(request),
    bypassCaptcha: shouldBypassCaptcha(request),
    bypassRateLimiting: shouldBypassRateLimiting(request),
    bypassCsrf: shouldBypassCsrf(request),
    bypassCsp: shouldBypassCsp(request),
  }
}

