import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * CORS utility functions for API routes
 */

/**
 * Get allowed CORS origins from environment variables
 * Returns array of allowed origins
 */
export function getAllowedOrigins(): string[] {
  const originsEnv = process.env.ALLOWED_CORS_ORIGINS || ''

  if (!originsEnv || originsEnv.trim() === '') {
    // Default: allow same origin only
    return []
  }

  // Parse comma-separated list
  return originsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return false
  }

  const allowedOrigins = getAllowedOrigins()

  // If no origins configured, deny all CORS requests
  if (allowedOrigins.length === 0) {
    return false
  }

  // Check if origin is in allowed list
  return allowedOrigins.includes(origin)
}

/**
 * Get CORS headers for a _request
 */
export function getCorsHeaders(_request: NextRequest): Headers {
  const origin = _request.headers.get('origin')
  const headers = new Headers()

  if (origin && isOriginAllowed(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    headers.set('Access-Control-Max-Age', '86400') // 24 hours
  }

  return headers
}

/**
 * Handle CORS preflight _request
 */
export function handleCorsPreflightRequest(_request: NextRequest): NextResponse {
  const origin = _request.headers.get('origin')

  if (!origin || !isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 })
  }

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(_request),
  })
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(response: NextResponse, _request: NextRequest): NextResponse {
  const corsHeaders = getCorsHeaders(_request)

  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value)
  })

  return response
}
