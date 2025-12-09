import { randomBytes, createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SecurityAuditLogger } from './audit-logger'

/**
 * CSRF Protection Service
 *
 * Implements Double Submit Cookie pattern for CSRF protection
 * - Generates cryptographically secure tokens
 * - Validates tokens on state-changing operations
 * - Uses HMAC for token verification
 */

const CSRF_TOKEN_COOKIE = 'csrf-token'
const TOKEN_LENGTH = 32
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

// ✅ SECURITY IMPROVEMENT #7: Token rotation configuration
// Tokens older than this threshold should be rotated for better security
// Prefixed with _ to indicate it's intentionally unused (reserved for future implementation)
const _TOKEN_ROTATION_THRESHOLD = 60 * 60 * 1000 // 1 hour

/**
 * Get CSRF secret from environment with production validation
 * Lazy-loaded to avoid errors during build time
 */
let CSRF_SECRET: string | null = null;

function getCsrfSecret(): string {
  // Return cached value if already loaded
  if (CSRF_SECRET !== null) {
    return CSRF_SECRET;
  }

  // ✅ SECURITY FIX: NEVER use NEXTAUTH_SECRET as fallback - secrets must be separate
  // Previous version: const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  const secret = process.env.CSRF_SECRET;

  // In production runtime (not build time), CSRF_SECRET must be set
  // Skip validation during build (when we're not actually handling requests)
  const isProductionRuntime = process.env.NODE_ENV === 'production' && typeof window === 'undefined';
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

  if (isProductionRuntime && !isBuildTime && !secret) {
    throw new Error(
      '❌ CRITICAL: CSRF_SECRET environment variable is required in production.\n' +
      'DO NOT reuse NEXTAUTH_SECRET - each secret must be unique.\n' +
      'Generate a new one with: openssl rand -hex 32\n' +
      'Add to .env: CSRF_SECRET=<generated-secret>'
    );
  }

  // In development, use a fallback but warn
  if (!secret) {
    if (!isBuildTime) {
      console.warn(
        '[CSRF] ⚠️  WARNING: CSRF_SECRET not set. Using development fallback.\n' +
        '   Set CSRF_SECRET in .env.local for development.\n' +
        '   NEVER use NEXTAUTH_SECRET - secrets must be separate!'
      );
    }
    CSRF_SECRET = 'dev-csrf-secret-not-for-production-use';
    return CSRF_SECRET;
  }

  // Validate secret length (should be at least 32 characters)
  if (secret.length < 32 && !isBuildTime) {
    console.warn(
      '[CSRF] ⚠️  WARNING: CSRF_SECRET should be at least 32 characters long. ' +
      'Generate a secure one with: openssl rand -hex 32'
    );
  }

  CSRF_SECRET = secret;
  return CSRF_SECRET;
}

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  const secret = getCsrfSecret();
  const token = randomBytes(TOKEN_LENGTH).toString('base64url')
  const timestamp = Date.now().toString()
  const signature = createHmac('sha256', secret)
    .update(`${token}.${timestamp}`)
    .digest('base64url')

  return `${token}.${timestamp}.${signature}`
}

/**
 * Validates a CSRF token
 *
 * @param token - Token to validate
 * @param maxAge - Maximum age of token in milliseconds (default: 24 hours)
 * @returns true if valid, false otherwise
 */
export function validateCsrfToken(token: string, maxAge: number = COOKIE_MAX_AGE * 1000): boolean {
  if (!token) {
    return false
  }

  try {
    const secret = getCsrfSecret();
    const parts = token.split('.')
    if (parts.length !== 3) {
      return false
    }

    const [tokenValue, timestamp, signature] = parts

    // Verify signature
    const expectedSignature = createHmac('sha256', secret)
      .update(`${tokenValue}.${timestamp}`)
      .digest('base64url')

    if (signature !== expectedSignature) {
      return false
    }

    // Check if token has expired
    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (tokenAge > maxAge) {
      return false
    }

    return true
  } catch (error) {
    console.error('CSRF token validation error:', error)
    return false
  }
}

/**
 * Sets CSRF token cookie (server-side)
 */
export async function setCsrfTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies()

  // Get cookie domain from environment variable (optional)
  // If set, allows cookies to work across subdomains
  // Example: CSRF_COOKIE_DOMAIN=.purvitahealth.com
  const cookieDomain = process.env.CSRF_COOKIE_DOMAIN

  const cookieOptions: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  }

  // Only set domain if explicitly configured
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain
  }

  cookieStore.set(CSRF_TOKEN_COOKIE, token, cookieOptions)
}

/**
 * Gets CSRF token from cookies (server-side)
 */
export async function getCsrfTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_TOKEN_COOKIE)?.value
}

/**
 * Clears CSRF token cookie
 */
export async function clearCsrfTokenCookie(): Promise<void> {
  const cookieStore = await cookies()

  const cookieDomain = process.env.CSRF_COOKIE_DOMAIN

  const cookieOptions: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  }

  if (cookieDomain) {
    cookieOptions.domain = cookieDomain
  }

  cookieStore.set(CSRF_TOKEN_COOKIE, '', cookieOptions)
}

/**
 * Client-side CSRF token management
 */
export const csrfClient = {
  /**
   * Gets CSRF token from meta tag or cookie
   */
  getToken(): string | null {
    if (typeof document === 'undefined') {
      return null
    }

    // Try to get from meta tag first (recommended)
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    if (metaTag?.content) {
      return metaTag.content
    }

    // Fallback to reading from cookie
    const cookies = document.cookie.split(';')
    const csrfCookie = cookies.find((cookie) => cookie.trim().startsWith(`${CSRF_TOKEN_COOKIE}=`))

    if (csrfCookie) {
      return csrfCookie.split('=')[1]
    }

    return null
  },

  /**
   * Adds CSRF token to fetch headers
   */
  addTokenToHeaders(headers: HeadersInit = {}): HeadersInit {
    const token = this.getToken()

    if (token) {
      return {
        ...headers,
        'X-CSRF-Token': token,
      }
    }

    return headers
  },

  /**
   * Makes a protected fetch request with CSRF token
   */
  async protectedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = this.addTokenToHeaders(options.headers)

    return fetch(url, {
      ...options,
      headers,
    })
  },
}

/**
 * Server-side CSRF validation middleware
 * Use this in API routes that modify data (POST, PUT, DELETE, PATCH)
 */
export async function validateCsrfFromRequest(request: Request): Promise<boolean> {
  const token = request.headers.get('X-CSRF-Token')

  if (!token) {
    // Log missing CSRF token
    await SecurityAuditLogger.logCsrfValidationFailed({
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim(),
      requestPath: new URL(request.url).pathname,
      requestMethod: request.method,
      reason: 'Token missing',
    })
    return false
  }

  const cookieToken = await getCsrfTokenFromCookie()

  // Both tokens must exist and match
  if (!cookieToken || token !== cookieToken) {
    // Log token mismatch
    await SecurityAuditLogger.logCsrfValidationFailed({
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim(),
      requestPath: new URL(request.url).pathname,
      requestMethod: request.method,
      reason: 'Token mismatch',
    })
    return false
  }

  // Validate token structure and expiration
  const isValid = validateCsrfToken(token)

  if (!isValid) {
    // Log invalid token
    await SecurityAuditLogger.logCsrfValidationFailed({
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim(),
      requestPath: new URL(request.url).pathname,
      requestMethod: request.method,
      reason: 'Token invalid or expired',
    })
  }

  return isValid
}

/**
 * API route helper for CSRF protection
 * Returns error response if CSRF validation fails
 */
export async function requireCsrfToken(request: Request): Promise<NextResponse | null> {
  const isValid = await validateCsrfFromRequest(request)

  if (!isValid) {
    return NextResponse.json(
      {
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please refresh the page and try again.',
      },
      {
        status: 403,
      }
    )
  }

  return null
}
