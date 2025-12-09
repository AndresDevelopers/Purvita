import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit, RateLimitPresets } from '@/lib/utils/rate-limit'
import { handleCorsPreflightRequest, addCorsHeaders } from '@/lib/utils/cors'
import { generateNonce, getCSPWithNonce } from '@/lib/security/csp-nonce'
import { getAffiliateCSP, isAffiliatePage } from '@/lib/security/csp-affiliate'
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger'
import { threatIntelligence } from '@/lib/security/threat-intelligence'
import { isIPBlocked } from '@/lib/security/blocked-ip-checker'
import { autoBlockService } from '@/lib/security/auto-block-service'
import { getRateLimitConfig } from '@/lib/helpers/rate-limit-config-helper'
import { getTrustedAgentService } from '@/lib/security/trusted-agent-service'
import { checkAdminIPWhitelist } from '@/lib/security/admin-ip-whitelist'
import { getAdminBypassUrl } from '@/lib/utils/admin-bypass-url'

// Supported locales for automatic language detection
const SUPPORTED_LOCALES = ['en', 'es'] as const
const DEFAULT_LOCALE = 'en'
const LOCALE_COOKIE_NAME = 'NEXT_LOCALE'

/**
 * Detect the preferred locale from the Accept-Language header
 * Returns the best matching supported locale or the default
 */
function getPreferredLocale(request: NextRequest): string {
  // First check if user has a saved preference in cookie
  const savedLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as typeof SUPPORTED_LOCALES[number])) {
    return savedLocale
  }

  // Parse Accept-Language header
  const acceptLanguage = request.headers.get('Accept-Language')
  if (!acceptLanguage) {
    return DEFAULT_LOCALE
  }

  // Parse and sort by quality value (q)
  // Format: "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7"
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=')
      return {
        code: code.split('-')[0].toLowerCase(), // Get base language code (es-MX -> es)
        quality: qValue ? parseFloat(qValue) : 1.0,
      }
    })
    .sort((a, b) => b.quality - a.quality)

  // Find the first matching supported locale
  for (const lang of languages) {
    if (SUPPORTED_LOCALES.includes(lang.code as typeof SUPPORTED_LOCALES[number])) {
      return lang.code
    }
  }

  return DEFAULT_LOCALE
}

/**
 * Global middleware for security and rate limiting
 *
 * This middleware runs before all requests and implements:
 * - Trusted agent detection (Manus, etc.) with bypass capabilities
 * - Manual IP blocking (from blocked_ips table)
 * - Multi-layer threat intelligence (abuse.ch, VirusTotal, Google Safe Browsing)
 * - CORS configuration from environment variables
 * - Rate limiting for API routes using environment variables
 * - CSP nonce generation for secure inline scripts
 * - Additional security checks
 *
 * Configuration via environment variables:
 * - ABUSE_CH_API_ENABLED: Enable/disable abuse.ch integration
 * - VIRUSTOTAL_API_ENABLED: Enable/disable VirusTotal integration
 * - GOOGLE_SAFE_BROWSING_ENABLED: Enable/disable Google Safe Browsing
 * - THREAT_INTELLIGENCE_STRATEGY: Strategy for combining services (any/majority/all)
 * - ALLOWED_CORS_ORIGINS: Comma-separated list of allowed origins
 * - API_RATE_LIMIT_REQUESTS: Number of requests allowed (default: 60)
 * - API_RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 60000)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ✅ INTERNATIONALIZATION: Automatic language detection and redirection
  // Check if the path is the root or doesn't have a locale prefix
  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  // If accessing root path without locale, redirect to detected locale
  if (pathname === '/') {
    const detectedLocale = getPreferredLocale(request)
    const response = NextResponse.redirect(new URL(`/${detectedLocale}`, request.url))
    // Save the detected locale in a cookie for future visits
    response.cookies.set(LOCALE_COOKIE_NAME, detectedLocale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
      sameSite: 'lax',
    })
    return response
  }

  // Track if we need to update locale cookie (will be applied at the end)
  let localeToSave: string | null = null
  
  // If user manually navigates to a locale, save their preference
  if (pathnameHasLocale) {
    const locale = pathname.split('/')[1]
    const currentCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value
    
    // Only set cookie if it's different from current preference
    if (currentCookie !== locale) {
      localeToSave = locale
    }
  }

  // ✅ SECURITY: Block access to debug pages in production
  if (process.env.NODE_ENV === 'production' && pathname.startsWith('/admin/debug')) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // ✅ DYNAMIC ADMIN BYPASS URL: Handle configured bypass URL directly in middleware
  // This allows customizing the admin bypass URL via NEXT_PUBLIC_ADMIN_BYPASS_URL env var
  // Example: If NEXT_PUBLIC_ADMIN_BYPASS_URL=mi-panel-admin, then /en/mi-panel-admin validates token and redirects
  const configuredBypassUrl = getAdminBypassUrl()

  // Match pattern: /{lang}/{configuredBypassUrl}
  const bypassPattern = new RegExp(`^/([a-z]{2})/${configuredBypassUrl}$`)
  const match = pathname.match(bypassPattern)

  if (match) {
    const lang = match[1]
    const url = new URL(request.url)

    // ✅ SECURITY: Validate bypass token
    const token = url.searchParams.get('token')
    const validToken = process.env.ADMIN_BYPASS_TOKEN

    // If no token configured or token doesn't match, redirect to home page
    if (!validToken || token !== validToken) {
      // Redirect to home page with the language
      return NextResponse.redirect(new URL(`/${lang}`, request.url))
    }

    // ✅ Token is valid, redirect to admin login with language
    const adminLoginUrl = new URL(`/admin/login?lang=${lang}`, request.url)
    return NextResponse.redirect(adminLoginUrl)
  }

  // Redirect /{lang}/admin to /{lang} (home page)
  // The real admin panel is at /admin (without lang prefix)
  // This prevents users from accessing /{lang}/admin which doesn't exist
  const langAdminPattern = /^\/[a-z]{2}\/admin/i
  if (langAdminPattern.test(pathname)) {
    const lang = pathname.split('/')[1]
    return NextResponse.redirect(new URL(`/${lang}`, request.url))
  }

  // ✅ SECURITY: Check IP whitelist for admin routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const whitelistError = await checkAdminIPWhitelist(request)
    if (whitelistError) {
      return whitelistError
    }
  }

  // Detect trusted agents (Manus, etc.) - they can bypass security
  const trustedAgentService = getTrustedAgentService()
  const trustedAgentDetection = await trustedAgentService.detectTrustedAgent(request)

  // Generate nonce for CSP on page requests (not API routes)
  const nonce = generateNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  // Store trusted agent info in headers for downstream use
  if (trustedAgentDetection.isTrusted) {
    requestHeaders.set('x-trusted-agent', 'true')
    requestHeaders.set('x-bypass-captcha', trustedAgentDetection.bypassCaptcha.toString())
    requestHeaders.set('x-bypass-rate-limiting', trustedAgentDetection.bypassRateLimiting.toString())
    requestHeaders.set('x-bypass-csrf', trustedAgentDetection.bypassCsrf.toString())
    requestHeaders.set('x-bypass-csp', trustedAgentDetection.bypassCsp.toString())
  }

  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handleCorsPreflightRequest(request)
    }
  }

  // Apply rate limiting to all API routes (unless trusted agent bypasses it)
  if (pathname.startsWith('/api/')) {
    // Get identifier from request (IP address)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'

    // Skip IP blocking and threat intelligence for trusted agents
    const skipSecurityChecks = trustedAgentDetection.isTrusted && trustedAgentDetection.bypassRateLimiting

    // 1. Check if IP is manually blocked in database (skip for trusted agents)
    if (ip !== 'anonymous' && !skipSecurityChecks) {
      const blockedIPResult = await isIPBlocked(ip)

      if (blockedIPResult.isBlocked) {
        // Log the blocked request
        await SecurityAuditLogger.log(
          SecurityEventType.MALICIOUS_IP_BLOCKED,
          SecurityEventSeverity.CRITICAL,
          `Blocked request from manually blocked IP: ${ip}`,
          {
            ipAddress: ip,
            requestPath: pathname,
            requestMethod: request.method,
            userAgent: request.headers.get('user-agent') || undefined,
            blockReason: blockedIPResult.reason,
            blockId: blockedIPResult.blockId,
          },
          false
        )

        // Block the request
        return new Response(
          JSON.stringify({
            error: 'Access Denied',
            message: 'Your IP address has been blocked. Please contact support if you believe this is an error.',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }
    }

    // 2. Check for malicious IPs using threat intelligence (multi-service) (skip for trusted agents)
    const services = threatIntelligence.getEnabledServices()
    if (services.totalEnabled > 0 && ip !== 'anonymous' && !skipSecurityChecks) {
      const threatResult = await threatIntelligence.checkIp(ip, {
        ipAddress: ip,
        requestPath: pathname,
        requestMethod: request.method,
        userAgent: request.headers.get('user-agent') || undefined,
      })

      if (threatResult.isThreat) {
        // Log the blocked request with details from all services
        const detectedSources = threatResult.sources
          .filter((s) => s.result.isThreat)
          .map((s) => s.name)
          .join(', ')

        await SecurityAuditLogger.log(
          SecurityEventType.MALICIOUS_IP_BLOCKED,
          SecurityEventSeverity.CRITICAL,
          `Blocked request from malicious IP: ${ip} (detected by: ${detectedSources})`,
          {
            ipAddress: ip,
            requestPath: pathname,
            requestMethod: request.method,
            userAgent: request.headers.get('user-agent') || undefined,
            threatConfidence: threatResult.confidence,
            threatSources: detectedSources,
            threatSummary: threatResult.summary,
          },
          false
        )

        // Auto-block the IP and create fraud alert if enabled
        const isAutoBlockEnabled = await autoBlockService.isEnabled();
        if (isAutoBlockEnabled) {
          // Process threat detection in background (don't await to avoid blocking the request)
          autoBlockService.processThreatDetection(ip, threatResult, {
            requestPath: pathname,
            requestMethod: request.method,
            userAgent: request.headers.get('user-agent') || undefined,
            // userId can be extracted from auth token if needed
          }).catch((error) => {
            console.error('[AutoBlock] Failed to process threat detection:', error)
          })
        }

        // Block the request
        return new Response(
          JSON.stringify({
            error: 'Access Denied',
            message: 'Your request has been blocked for security reasons.',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }
    }

    // Skip rate limiting for trusted agents if they have bypass permission
    const shouldBypassRateLimit = trustedAgentDetection.isTrusted && trustedAgentDetection.bypassRateLimiting

    if (!shouldBypassRateLimit) {
      // Get rate limit config from database (with fallback to environment variables)
      const config = await getRateLimitConfig()
      const limitRequests = config.apiRateLimitRequests
      const limitWindowMs = config.apiRateLimitWindowMs

      // Determine rate limit based on endpoint
      // ✅ SECURITY: Stricter rate limits for sensitive endpoints
      const isAuthEndpoint =
        pathname.startsWith('/api/auth/') ||
        pathname.includes('/login') ||
        pathname.includes('/register') ||
        pathname.includes('/password')

      const isAdminEndpoint = pathname.startsWith('/api/admin/')
      const isReferralResolveEndpoint = pathname === '/api/referrals/resolve'

      // Apply rate limiting: strict for auth/admin/referrals, database/env config for others
      let rateLimitConfig
      if (isAuthEndpoint || isReferralResolveEndpoint) {
        rateLimitConfig = RateLimitPresets.strict // 10 req/min
      } else if (isAdminEndpoint) {
        // ✅ SECURITY: Admin endpoints get stricter limits than regular API
        rateLimitConfig = { limit: 100, window: 60 } // 100 req/min (vs 60 for regular API)
      } else {
        rateLimitConfig = { limit: limitRequests, window: Math.floor(limitWindowMs / 1000) }
      }

      const result = await rateLimit(ip, rateLimitConfig)

      if (!result.success) {
        // Log rate limit exceeded
        await SecurityAuditLogger.logRateLimitExceeded(ip, {
          ipAddress: ip,
          requestPath: pathname,
          requestMethod: request.method,
          userAgent: request.headers.get('user-agent') || undefined,
          limit: result.limit,
          reset: result.reset,
        })

        // Only expose rate limit headers on 429 responses to prevent attackers
        // from using this information to optimize their timing
        return new Response(
          JSON.stringify({
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please try again later.',
            retryAfter: result.reset,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': result.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.reset.toString(),
              'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString(),
            },
          }
        )
      }
    }

    // Log trusted agent activity if applicable
    if (trustedAgentDetection.isTrusted && trustedAgentDetection.agent) {
      await trustedAgentService.logAgentActivity(
        trustedAgentDetection.agent,
        request,
        {
          rateLimiting: shouldBypassRateLimit,
          captcha: trustedAgentDetection.bypassCaptcha,
          csrf: trustedAgentDetection.bypassCsrf,
          csp: trustedAgentDetection.bypassCsp,
        }
      )
    }

    // Don't expose rate limit headers on successful requests to reduce information leakage
    // This prevents attackers from knowing exactly how many requests they have left
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    // Add nonce header for client-side access (API routes)
    response.headers.set('x-nonce', nonce)

    // ✅ SECURITY: Add X-Frame-Options to prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Add CSP with nonce by default (skip for trusted agents if they have bypass)
    // Set DISABLE_CSP_DEV=true in .env.local to disable CSP in development if needed for debugging
    const enableCSP = process.env.DISABLE_CSP_DEV !== 'true';
    const shouldBypassCSP = trustedAgentDetection.isTrusted && trustedAgentDetection.bypassCsp

    if (enableCSP && !shouldBypassCSP) {
      // ✅ SECURITY: Use stricter CSP for affiliate pages
      const cspHeader = isAffiliatePage(pathname)
        ? getAffiliateCSP(nonce)
        : getCSPWithNonce(nonce);
      response.headers.set('Content-Security-Policy', cspHeader)
    }

    // Add CORS headers if configured
    return addCorsHeaders(response, request)
  }

  // For non-API routes, add CSP with nonce in production
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add nonce header for client-side access
  response.headers.set('x-nonce', nonce)

  // ✅ SECURITY: Add X-Frame-Options to prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Add CSP with nonce by default (skip for trusted agents if they have bypass)
  // Set DISABLE_CSP_DEV=true in .env.local to disable CSP in development if needed for debugging
  const enableCSP = process.env.DISABLE_CSP_DEV !== 'true';
  const shouldBypassCSP = trustedAgentDetection.isTrusted && trustedAgentDetection.bypassCsp

  if (enableCSP && !shouldBypassCSP) {
    // ✅ SECURITY: Use stricter CSP for affiliate pages
    const cspHeader = isAffiliatePage(pathname)
      ? getAffiliateCSP(nonce)
      : getCSPWithNonce(nonce);
    response.headers.set('Content-Security-Policy', cspHeader)
  }

  // ✅ INTERNATIONALIZATION: Save locale preference if user changed it
  if (localeToSave) {
    response.cookies.set(LOCALE_COOKIE_NAME, localeToSave, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
      sameSite: 'lax',
    })
  }

  return response
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all requests except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
