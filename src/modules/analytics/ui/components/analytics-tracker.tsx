'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAnalytics, initializeDataLayer } from '../hooks/use-analytics';

/**
 * Analytics Tracker Component
 * Automatically tracks page views and initializes analytics
 *
 * Usage:
 * Add this component to your root layout:
 * <AnalyticsTracker />
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const { trackPageView } = useAnalytics();

  // Initialize dataLayer on mount
  useEffect(() => {
    initializeDataLayer();
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (pathname) {
      trackPageView(pathname, document.title);
    }
  }, [pathname, trackPageView]);

  return null;
}
