'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { getConsentStatus } from '@/modules/analytics/ui/components/privacy-consent';

interface AdvertisingScriptsConfig {
  facebookPixel: { enabled: boolean; id: string | null; script: string | null };
  tiktokPixel: { enabled: boolean; id: string | null; script: string | null };
  gtm: { enabled: boolean; containerId: string | null; script: string | null };
}

/**
 * Advertising Scripts Injector Component
 * 
 * Injects advertising scripts (Facebook Pixel, TikTok Pixel, Google Tag Manager)
 * ONLY in main public pages, NOT in affiliate personalized pages.
 * 
 * Detects affiliate pages by checking if the URL contains a referral code pattern.
 */
export function AdvertisingScriptsInjector() {
  const pathname = usePathname();
  const [config, setConfig] = useState<AdvertisingScriptsConfig | null>(null);
  const [shouldInject, setShouldInject] = useState(false);

  useEffect(() => {
    const isAffiliatePage =
      pathname?.includes('/ref/') ||
      pathname?.includes('/affiliate/') ||
      (typeof window !== 'undefined' && window.location.search.includes('ref='));

    const consent = getConsentStatus();
    const allowed = Boolean(consent?.tracking);
    const inject = allowed && !isAffiliatePage;
    setShouldInject(inject);

    if (inject) {
      loadConfig();
    }
  }, [pathname]);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/public/advertising-scripts');
      if (!response.ok) {
        console.error('[AdvertisingScripts] Failed to load configuration');
        return;
      }
      
      const data: AdvertisingScriptsConfig = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('[AdvertisingScripts] Error loading configuration:', error);
    }
  };

  // Don't render anything if we shouldn't inject or config is not loaded
  if (!shouldInject || !config) {
    return null;
  }

  return (
    <>
      {/* Facebook Pixel */}
      {config.facebookPixel.enabled && config.facebookPixel.script && (
        <Script
          id="facebook-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: config.facebookPixel.script }}
        />
      )}

      {/* TikTok Pixel */}
      {config.tiktokPixel.enabled && config.tiktokPixel.script && (
        <Script
          id="tiktok-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: config.tiktokPixel.script }}
        />
      )}

      {/* Google Tag Manager */}
      {config.gtm.enabled && config.gtm.script && (
        <Script
          id="google-tag-manager"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: config.gtm.script }}
        />
      )}
    </>
  );
}
