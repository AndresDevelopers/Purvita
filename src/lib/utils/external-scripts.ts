/**
 * External Scripts Configuration with SRI
 * 
 * Provides Subresource Integrity (SRI) hashes for external scripts
 * to prevent CDN compromise attacks.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
 * @see docs/security-best-practices.md
 */

export interface ExternalScript {
  src: string;
  integrity?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  async?: boolean;
  defer?: boolean;
}

/**
 * External scripts with SRI hashes
 * 
 * NOTE: SRI hashes must be updated when script versions change.
 * Generate new hashes at: https://www.srihash.org/
 * 
 * To generate hash manually:
 * ```bash
 * curl -s https://js.stripe.com/v3/ | openssl dgst -sha384 -binary | openssl base64 -A
 * ```
 */
export const EXTERNAL_SCRIPTS = {
  // Stripe.js v3
  // NOTE: Stripe.js is dynamically updated, so SRI is not recommended by Stripe
  // See: https://stripe.com/docs/js/including
  stripe: {
    src: 'https://js.stripe.com/v3/',
    crossOrigin: 'anonymous' as const,
    async: true,
    // integrity: undefined, // Stripe updates their script frequently
  },

  // PayPal SDK
  // NOTE: PayPal SDK is also dynamically updated
  paypal: {
    src: 'https://www.paypal.com/sdk/js',
    crossOrigin: 'anonymous' as const,
    async: true,
    // integrity: undefined, // PayPal updates their script frequently
  },

  // Google Analytics (if used)
  // NOTE: Google Analytics is dynamically updated
  googleAnalytics: {
    src: 'https://www.googletagmanager.com/gtag/js',
    crossOrigin: 'anonymous' as const,
    async: true,
    // integrity: undefined, // Google updates frequently
  },
} as const;

/**
 * Get script props for use in Next.js Script component
 * 
 * @param scriptKey - Key from EXTERNAL_SCRIPTS
 * @returns Props for Next.js Script component
 * 
 * @example
 * ```tsx
 * import Script from 'next/script';
 * import { getScriptProps, EXTERNAL_SCRIPTS } from '@/lib/utils/external-scripts';
 * 
 * export function MyComponent() {
 *   return (
 *     <Script {...getScriptProps('stripe')} />
 *   );
 * }
 * ```
 */
export function getScriptProps(scriptKey: keyof typeof EXTERNAL_SCRIPTS): ExternalScript {
  return EXTERNAL_SCRIPTS[scriptKey];
}

/**
 * Security notes for external scripts:
 * 
 * 1. **Stripe & PayPal**: These scripts are intentionally updated frequently
 *    by the providers to fix bugs and add features. Using SRI would break
 *    the integration when they update. Instead, we rely on:
 *    - HTTPS (prevents MITM attacks)
 *    - crossOrigin="anonymous" (prevents credential leakage)
 *    - Content Security Policy (CSP) whitelist
 * 
 * 2. **Static Libraries**: For libraries that don't auto-update (e.g., jQuery,
 *    Bootstrap from CDN), ALWAYS use SRI hashes.
 * 
 * 3. **Self-Hosted**: Consider self-hosting critical scripts to have full
 *    control over versions and enable SRI.
 * 
 * 4. **CSP**: Always use Content Security Policy to whitelist allowed script
 *    sources. See next.config.ts for CSP configuration.
 */

/**
 * Example: How to add a new external script with SRI
 * 
 * 1. Find the script URL
 * 2. Generate SRI hash at https://www.srihash.org/
 * 3. Add to EXTERNAL_SCRIPTS:
 * 
 * ```typescript
 * myLibrary: {
 *   src: 'https://cdn.example.com/library@1.0.0/lib.min.js',
 *   integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/ux...',
 *   crossOrigin: 'anonymous',
 *   async: true,
 * }
 * ```
 * 
 * 4. Use in component:
 * ```tsx
 * <Script {...getScriptProps('myLibrary')} />
 * ```
 */

