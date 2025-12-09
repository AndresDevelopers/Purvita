import { headers } from 'next/headers'

/**
 * CSP Nonce Service
 *
 * Generates and manages cryptographically secure nonces for Content Security Policy
 * Allows inline scripts while maintaining XSS protection
 */

const NONCE_HEADER = 'x-nonce'

/**
 * Generates a cryptographically secure nonce using Web Crypto API
 * Compatible with Edge Runtime
 *
 * @returns Base64-encoded random nonce
 */
export function generateNonce(): string {
  const buffer = new Uint8Array(16)
  crypto.getRandomValues(buffer)

  // Convert to base64
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64
}

/**
 * Gets the current nonce from headers (server-side only)
 *
 * @returns The nonce value or undefined
 */
export async function getNonce(): Promise<string | undefined> {
  try {
    const headersList = await headers()
    return headersList.get(NONCE_HEADER) || undefined
  } catch (error) {
    console.error('Error getting nonce from headers:', error)
    return undefined
  }
}

/**
 * Creates CSP header value with nonce
 *
 * @param nonce - The nonce to include in the CSP
 * @returns CSP header value
 *
 * Includes all external resources used by the application:
 *
 * PAYMENT PROVIDERS:
 * - Stripe (credit/debit cards)
 * - PayPal (PayPal payments - sandbox + production)
 * - Authorize.net (credit/debit cards - sandbox + production)
 * - Payoneer (payouts)
 *
 * ANALYTICS & ADVERTISING:
 * - Vercel Analytics & Speed Insights (performance monitoring)
 * - Facebook Pixel (advertising)
 * - TikTok Pixel (advertising)
 * - Google Tag Manager / Analytics (analytics + advertising)
 *
 * BACKEND SERVICES:
 * - Supabase (database, auth, storage)
 * - Upstash (Redis for rate limiting)
 *
 * INFRASTRUCTURE & CDN:
 * - Cloudflare (CDN, DDoS protection, caching)
 * - Vercel (hosting, edge functions)
 *
 * CUSTOMER SUPPORT:
 * - Tawk.to (live chat widget)
 *
 * SECURITY & CAPTCHA:
 * - Google reCAPTCHA v2/v3 (bot protection)
 * - hCaptcha (bot protection)
 * - Cloudflare Turnstile (bot protection)
 *
 * EXTERNAL APIS (server-side only, not in CSP):
 * - ipapi.co (IP geolocation)
 * - ip-api.com (IP geolocation fallback)
 *
 * IMAGE SOURCES:
 * - Supabase Storage (product images, branding)
 * - Unsplash (placeholder images)
 * - Picsum Photos (placeholder images)
 * - Placehold.co (placeholder images)
 */
export function getCSPWithNonce(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",

    // ✅ SECURITY: Prevent clickjacking with frame-ancestors
    "frame-ancestors 'none'",

    // Scripts: App + Payment Providers + Analytics + Advertising + Customer Support + CAPTCHA
    `script-src 'self' 'nonce-${nonce}' ` +
    'https://purvitahealth.com ' +                // Main production domain
    'https://www.purvitahealth.com ' +            // Main production domain (www)
    'https://js.stripe.com ' +                    // Stripe SDK
    'https://www.paypal.com ' +                   // PayPal SDK
    'https://api.authorize.net ' +                // Authorize.net SDK (production)
    'https://apitest.authorize.net ' +            // Authorize.net SDK (sandbox)
    'https://jstest.authorize.net ' +             // Authorize.net Accept.js (sandbox)
    'https://js.authorize.net ' +                 // Authorize.net Accept.js (production)
    'https://*.payoneer.com ' +                   // Payoneer SDK
    'https://*.vercel-insights.com ' +            // Vercel Analytics
    'https://va.vercel-scripts.com ' +            // Vercel Analytics (alternative domain)
    'https://connect.facebook.net ' +             // Facebook Pixel
    'https://analytics.tiktok.com ' +             // TikTok Pixel
    'https://www.googletagmanager.com ' +         // Google Tag Manager
    'https://www.google-analytics.com ' +         // Google Analytics (Universal Analytics)
    'https://ssl.google-analytics.com ' +         // Google Analytics SSL
    'https://*.googletagmanager.com ' +           // Google Tag Manager (all subdomains)
    'https://embed.tawk.to ' +                    // Tawk.to Chat Widget
    'https://*.cloudflareinsights.com ' +         // Cloudflare Web Analytics
    'https://www.google.com ' +                   // Google reCAPTCHA v2/v3
    'https://www.gstatic.com ' +                  // Google reCAPTCHA assets
    'https://js.hcaptcha.com ' +                  // hCaptcha
    'https://*.hcaptcha.com ' +                   // hCaptcha (alternative domains)
    'https://challenges.cloudflare.com',          // Cloudflare Turnstile

    // Styles: App + Tawk.to (needs unsafe-inline for dynamic styles)
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,  // unsafe-inline needed for Tawk.to and some dynamic styles

    // Images: App + External Image Sources + Analytics tracking pixels + Tawk.to
    "img-src 'self' data: https: blob: " +
    'https://purvitahealth.com ' +                // Main production domain
    'https://www.purvitahealth.com ' +            // Main production domain (www)
    'https://*.supabase.co ' +                    // Supabase Storage (product images, branding)
    'https://images.unsplash.com ' +              // Unsplash (placeholder images)
    'https://picsum.photos ' +                    // Picsum Photos (placeholder images)
    'https://placehold.co ' +                     // Placehold.co (placeholder images)
    'https://www.google-analytics.com ' +         // GA tracking pixels
    'https://www.facebook.com ' +                 // FB tracking pixels
    'https://*.tawk.to',                          // Tawk.to avatars and images

    // Fonts: App + Tawk.to
    "font-src 'self' data: " +
    'https://fonts.gstatic.com',                  // Google Fonts (if used by Tawk.to)

    // Connections: App + Backend + Payment Providers + Analytics + Geolocation APIs + Customer Support + CAPTCHA + Cloudflare Health Checks
    "connect-src 'self' " +
    'https://purvitahealth.com ' +                // Main production domain
    'https://www.purvitahealth.com ' +            // Main production domain (www)
    'https://*.supabase.co ' +                    // Supabase backend (API, Realtime, Storage)
    'wss://*.supabase.co ' +                      // Supabase Realtime (WebSocket)
    'https://*.upstash.io ' +                     // Upstash Redis (rate limiting)
    'https://api.stripe.com ' +                   // Stripe API
    'https://api.paypal.com ' +                   // PayPal API (production)
    'https://api-m.paypal.com ' +                 // PayPal API (production alt)
    'https://api-m.sandbox.paypal.com ' +         // PayPal API (sandbox/testing)
    'https://api.authorize.net ' +                // Authorize.net API (production)
    'https://apitest.authorize.net ' +            // Authorize.net API (sandbox)
    'https://api.payoneer.com ' +                 // Payoneer API (production)
    'https://api.sandbox.payoneer.com ' +         // Payoneer API (sandbox)
    'https://*.vercel-insights.com ' +            // Vercel Analytics
    'https://vitals.vercel-insights.com ' +       // Vercel Speed Insights
    'https://*.vercel.app ' +                     // Vercel deployments
    'https://*.vercel.com ' +                     // Vercel API
    'https://www.facebook.com ' +                 // Facebook Pixel API
    'https://connect.facebook.net ' +             // Facebook Pixel
    'https://analytics.tiktok.com ' +             // TikTok Pixel API
    'https://www.tiktok.com ' +                   // TikTok Pixel
    'https://www.googletagmanager.com ' +         // Google Tag Manager
    'https://www.google-analytics.com ' +         // Google Analytics
    'https://analytics.google.com ' +             // Google Analytics 4
    'https://ipapi.co ' +                         // IP Geolocation (primary)
    'http://ip-api.com ' +                        // IP Geolocation (fallback - HTTP only)
    'https://*.tawk.to ' +                        // Tawk.to Chat API
    'wss://*.tawk.to ' +                          // Tawk.to Chat WebSocket
    'https://*.cloudflareinsights.com ' +         // Cloudflare Web Analytics
    'https://api.cloudflare.com ' +               // Cloudflare API (Health Checks)
    'https://www.google.com ' +                   // Google reCAPTCHA API
    'https://www.gstatic.com ' +                  // Google reCAPTCHA assets
    'https://*.hcaptcha.com ' +                   // hCaptcha API
    'https://challenges.cloudflare.com ' +        // Cloudflare Turnstile API
    'https://www.recaptcha.net ' +                // Google reCAPTCHA alternative domain
    'https://recaptcha.net',                      // Google reCAPTCHA alternative domain (no www)

    // Frames/iframes: Payment providers + Email previews (srcDoc) + Tawk.to + CAPTCHA
    "frame-src 'self' " +
    'https://js.stripe.com ' +                    // Stripe Checkout
    'https://www.paypal.com ' +                   // PayPal Checkout
    'https://accept.authorize.net ' +             // Authorize.net Accept Hosted (production)
    'https://test.authorize.net ' +               // Authorize.net Accept Hosted (sandbox)
    'https://*.payoneer.com ' +                   // Payoneer hosted pages
    'https://embed.tawk.to ' +                    // Tawk.to Chat Widget
    'https://www.google.com ' +                   // Google reCAPTCHA iframe
    'https://www.gstatic.com ' +                  // Google reCAPTCHA assets
    'https://*.hcaptcha.com ' +                   // hCaptcha iframe
    'https://challenges.cloudflare.com ' +        // Cloudflare Turnstile iframe
    'https://www.recaptcha.net ' +                // Google reCAPTCHA alternative domain
    'https://recaptcha.net ' +                    // Google reCAPTCHA alternative domain (no www)
    'blob:',                                      // Blob URLs for email/invoice previews

    // Media: Allow media from same origin and data URIs
    "media-src 'self' data: blob:",

    // Workers: Allow web workers from same origin
    "worker-src 'self' blob:",

    // Security: Prevent common attacks
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ]

  return cspDirectives.join('; ')
}

/**
 * Gets CSP for development environment (using nonces for better security)
 */
export function getDevCSP(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: https:",
    "frame-src 'self'",
    "object-src 'none'",
  ]

  return cspDirectives.join('; ')
}

/**
 * Style nonce attribute helper
 * Use this to add nonce to inline styles
 *
 * @example
 * <style {...await styleNonceProps()}>
 *   .custom-style { color: red; }
 * </style>
 */
export async function styleNonceProps(): Promise<{ nonce: string } | Record<string, never>> {
  const nonce = await getNonce()
  return nonce ? { nonce } : {}
}

/**
 * Script nonce attribute helper
 * Use this to add nonce to inline scripts
 *
 * @example
 * <script {...await scriptNonceProps()}>
 *   console.log('Safe inline script')
 * </script>
 */
export async function scriptNonceProps(): Promise<{ nonce: string } | Record<string, never>> {
  const nonce = await getNonce()
  return nonce ? { nonce } : {}
}
