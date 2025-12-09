'use client';

import Script from 'next/script';
import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getConsentStatus } from '@/modules/analytics/ui/components/privacy-consent';

/**
 * Google Analytics 4 Component
 *
 * Integrates GA4 with Next.js App Router
 * Tracks page views automatically on route changes
 *
 * Environment Variables:
 * - NEXT_PUBLIC_GA_MEASUREMENT_ID: Your GA4 Measurement ID (G-XXXXXXXXXX)
 *
 * @example
 * // In root layout:
 * <GoogleAnalytics />
 */
export function GoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsContent />
    </Suspense>
  );
}

function GoogleAnalyticsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const consent = getConsentStatus();
    setAllowed(Boolean(consent?.tracking));
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!measurementId || !allowed) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Send pageview with custom parameters
    if (window.gtag) {
      window.gtag('config', measurementId, {
        page_path: url,
      });
    }
  }, [pathname, searchParams, measurementId, allowed]);

  // Don't render if no measurement ID
  if (!measurementId || !allowed) {
    return null;
  }

  return (
    <>
      {/* Google Analytics 4 - gtag.js */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
              send_page_view: true
            });
          `,
        }}
      />
    </>
  );
}

/**
 * Google Tag Manager Component (Alternative to GA4)
 * 
 * Use this if you prefer GTM over direct GA4 integration
 * GTM allows you to manage multiple tags from one interface
 * 
 * Environment Variables:
 * - NEXT_PUBLIC_GTM_ID: Your GTM Container ID (GTM-XXXXXXX)
 */
export function GoogleTagManager() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  if (!gtmId) {
    return null;
  }

  return (
    <>
      {/* Google Tag Manager - Head */}
      <Script
        id="google-tag-manager"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `,
        }}
      />
      {/* Google Tag Manager - Body (noscript fallback) */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  );
}

declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void;
  }
}
