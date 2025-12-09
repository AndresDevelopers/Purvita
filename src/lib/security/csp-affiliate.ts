/**
 * CSP Configuration for Affiliate Pages
 * 
 * Provides a more restrictive CSP for affiliate pages to enhance security.
 * Affiliate pages don't need all the third-party services that the main site uses.
 */

/**
 * Get CSP for affiliate pages (more restrictive than main site)
 * 
 * @param nonce - Cryptographic nonce for inline scripts
 * @returns CSP header value for affiliate pages
 */
export function getAffiliateCSP(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",

    // ✅ SECURITY: Prevent clickjacking with frame-ancestors
    "frame-ancestors 'none'",

    // Scripts: Only app + essential services (no marketing pixels)
    `script-src 'self' 'nonce-${nonce}' ` +
      'https://purvitahealth.com ' +                // Main production domain
      'https://www.purvitahealth.com ' +            // Main production domain (www)
      'https://js.stripe.com ' +                    // Stripe SDK (for payments)
      'https://www.paypal.com ' +                   // PayPal SDK (for payments)
      'https://*.vercel-insights.com ' +            // Vercel Analytics (performance monitoring)
      'https://va.vercel-scripts.com ' +            // Vercel Analytics (alternative domain)
      'https://www.google.com ' +                   // Google reCAPTCHA (if enabled)
      'https://www.gstatic.com ' +                  // Google reCAPTCHA assets
      'https://js.hcaptcha.com ' +                  // hCaptcha (if enabled)
      'https://*.hcaptcha.com ' +                   // hCaptcha (alternative domains)
      'https://challenges.cloudflare.com',          // Cloudflare Turnstile (if enabled)

    // Styles: App only (no third-party styles)
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,  // unsafe-inline for dynamic styles

    // Images: App + Supabase Storage + Production domain
    "img-src 'self' data: https: blob: " +
      'https://purvitahealth.com ' +                // Main production domain
      'https://www.purvitahealth.com ' +            // Main production domain (www)
      'https://*.supabase.co',                      // Supabase Storage (product images, branding)

    // Fonts: App only
    "font-src 'self' data: " +
      'https://fonts.gstatic.com',                  // Google Fonts (if used)

    // Connections: App + Backend + Payment Providers (no marketing/analytics APIs)
    "connect-src 'self' " +
      'https://purvitahealth.com ' +                // Main production domain
      'https://www.purvitahealth.com ' +            // Main production domain (www)
      'https://*.supabase.co ' +                    // Supabase API
      'wss://*.supabase.co ' +                      // Supabase Realtime (WebSocket)
      'https://*.upstash.io ' +                     // Upstash Redis (rate limiting)
      'https://api.stripe.com ' +                   // Stripe API
      'https://api.paypal.com ' +                   // PayPal API (production)
      'https://api-m.paypal.com ' +                 // PayPal API (production alt)
      'https://api-m.sandbox.paypal.com ' +         // PayPal API (sandbox/testing)
      'https://*.vercel-insights.com ' +            // Vercel Analytics
      'https://vitals.vercel-insights.com ' +       // Vercel Speed Insights
      'https://*.vercel.app ' +                     // Vercel deployments
      'https://*.vercel.com ' +                     // Vercel API
      'https://www.google.com ' +                   // Google reCAPTCHA API
      'https://www.gstatic.com ' +                  // Google reCAPTCHA assets
      'https://*.hcaptcha.com ' +                   // hCaptcha API
      'https://challenges.cloudflare.com ' +        // Cloudflare Turnstile API
      'https://www.recaptcha.net ' +                // Google reCAPTCHA alternative domain
      'https://recaptcha.net',                      // Google reCAPTCHA alternative domain (no www)

    // Frames/iframes: Payment providers only (no marketing iframes)
    "frame-src 'self' " +
      'https://js.stripe.com ' +                    // Stripe Checkout
      'https://www.paypal.com ' +                   // PayPal Checkout
      'https://www.google.com ' +                   // Google reCAPTCHA iframe
      'https://www.gstatic.com ' +                  // Google reCAPTCHA assets
      'https://*.hcaptcha.com ' +                   // hCaptcha iframe
      'https://challenges.cloudflare.com ' +        // Cloudflare Turnstile iframe
      'https://www.recaptcha.net ' +                // Google reCAPTCHA alternative domain
      'https://recaptcha.net ' +                    // Google reCAPTCHA alternative domain (no www)
      'blob:',                                      // Blob URLs for previews

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
  ];

  return cspDirectives.join('; ');
}

/**
 * Check if a path is an affiliate page
 * 
 * @param pathname - Request pathname
 * @returns true if path is an affiliate page
 */
export function isAffiliatePage(pathname: string): boolean {
  // Match /[lang]/affiliate/[referralCode]/*
  const affiliatePattern = /^\/[a-z]{2}\/affiliate\/[a-zA-Z0-9_-]+/;
  return affiliatePattern.test(pathname);
}

