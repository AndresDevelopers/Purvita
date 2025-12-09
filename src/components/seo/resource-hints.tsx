/**
 * Resource Hints Component
 * 
 * Optimizes loading of external resources using:
 * - dns-prefetch: Resolve DNS early for external domains
 * - preconnect: Establish early connections to critical origins
 * - prefetch: Hint browser to fetch resources that might be needed soon
 * 
 * This improves Core Web Vitals, especially LCP and FCP.
 */
export function ResourceHints() {
  return (
    <>
      {/* DNS Prefetch for external domains */}
      <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      <link rel="dns-prefetch" href="https://www.google-analytics.com" />
      
      {/* Preconnect to critical origins (includes DNS + TCP + TLS) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* Supabase - if using external storage */}
      <link rel="dns-prefetch" href="https://supabase.co" />
      
      {/* Payment providers */}
      <link rel="dns-prefetch" href="https://js.stripe.com" />
      <link rel="dns-prefetch" href="https://www.paypal.com" />
      
      {/* Analytics and monitoring */}
      <link rel="dns-prefetch" href="https://browser.sentry-cdn.com" />
      
      {/* CDN for images if using external CDN */}
      <link rel="dns-prefetch" href="https://images.unsplash.com" />
    </>
  );
}

/**
 * Preload Critical Resources
 * 
 * Use this for resources that are definitely needed for initial render.
 * Be selective - only preload truly critical resources.
 */
export function PreloadCriticalResources() {
  return (
    <>
      {/* Preload critical CSS - uncomment if you have critical CSS */}
      {/* <link rel="preload" href="/styles/critical.css" as="style" /> */}
      
      {/* Preload hero images - uncomment and update with actual hero image */}
      {/* <link
        rel="preload"
        href="/images/hero.webp"
        as="image"
        type="image/webp"
      /> */}
    </>
  );
}

