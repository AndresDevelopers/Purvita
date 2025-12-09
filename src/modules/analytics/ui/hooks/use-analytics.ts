'use client';

import { useCallback, useEffect, useRef } from 'react';
import type {
  AnalyticsEventType,
  AnalyticsEventParams,
  AnalyticsProductItem,
} from '../../domain/models/analytics-event';

/**
 * Session ID storage key
 */
const SESSION_ID_KEY = 'purvita_analytics_session';

/**
 * Get or create session ID
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Analytics tracking hook
 * Provides methods to track analytics events
 */
export function useAnalytics() {
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  /**
   * Track a generic event
   */
  const trackEvent = useCallback(
    async (
      eventType: AnalyticsEventType,
      params: AnalyticsEventParams = {},
      eventName?: string
    ) => {
      try {
        const response = await fetch('/api/analytics/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: eventType,
            event_name: eventName,
            session_id: sessionIdRef.current,
            params: {
              ...params,
              page_path: window.location.pathname,
              page_location: window.location.href,
              page_title: document.title,
            },
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          console.error('[Analytics] Failed to track event:', await response.text());
        }
      } catch (error) {
        console.error('[Analytics] Error tracking event:', error);
      }
    },
    []
  );

  /**
   * Track page view
   */
  const trackPageView = useCallback(
    (pagePath?: string, pageTitle?: string) => {
      return trackEvent('pageview', {
        page_path: pagePath || window.location.pathname,
        page_title: pageTitle || document.title,
      });
    },
    [trackEvent]
  );

  /**
   * Track product view
   */
  const trackProductView = useCallback(
    (product: AnalyticsProductItem) => {
      return trackEvent('product_view', {
        items: [product],
        value: product.price,
        currency: product.currency || 'USD',
      });
    },
    [trackEvent]
  );

  /**
   * Track add to cart
   */
  const trackAddToCart = useCallback(
    (product: AnalyticsProductItem) => {
      return trackEvent('add_to_cart', {
        items: [product],
        value: product.price * product.quantity,
        currency: product.currency || 'USD',
      });
    },
    [trackEvent]
  );

  /**
   * Track remove from cart
   */
  const trackRemoveFromCart = useCallback(
    (product: AnalyticsProductItem) => {
      return trackEvent('remove_from_cart', {
        items: [product],
        value: product.price * product.quantity,
        currency: product.currency || 'USD',
      });
    },
    [trackEvent]
  );

  /**
   * Track view cart
   */
  const trackViewCart = useCallback(
    (items: AnalyticsProductItem[], totalValue: number) => {
      return trackEvent('view_cart', {
        items,
        value: totalValue,
        currency: items[0]?.currency || 'USD',
      });
    },
    [trackEvent]
  );

  /**
   * Track begin checkout
   */
  const trackBeginCheckout = useCallback(
    (items: AnalyticsProductItem[], totalValue: number) => {
      return trackEvent('begin_checkout', {
        items,
        value: totalValue,
        currency: items[0]?.currency || 'USD',
      });
    },
    [trackEvent]
  );

  /**
   * Track add payment info
   */
  const trackAddPaymentInfo = useCallback(
    (paymentMethod: string, totalValue: number, currency = 'USD') => {
      return trackEvent('add_payment_info', {
        payment_method: paymentMethod,
        value: totalValue,
        currency,
      });
    },
    [trackEvent]
  );

  /**
   * Track purchase
   */
  const trackPurchase = useCallback(
    (
      transactionId: string,
      items: AnalyticsProductItem[],
      totalValue: number,
      options?: {
        tax?: number;
        shipping?: number;
        coupon?: string;
        paymentMethod?: string;
      }
    ) => {
      return trackEvent('purchase', {
        transaction_id: transactionId,
        items,
        value: totalValue,
        currency: items[0]?.currency || 'USD',
        tax: options?.tax,
        shipping: options?.shipping,
        coupon: options?.coupon,
        payment_method: options?.paymentMethod,
      });
    },
    [trackEvent]
  );

  /**
   * Track search
   */
  const trackSearch = useCallback(
    (searchTerm: string) => {
      return trackEvent('search', {
        search_term: searchTerm,
      });
    },
    [trackEvent]
  );

  /**
   * Track user signup
   */
  const trackSignup = useCallback(
    (method?: string) => {
      return trackEvent('user_signup', {
        custom_data: { method },
      });
    },
    [trackEvent]
  );

  /**
   * Track user login
   */
  const trackLogin = useCallback(
    (method?: string) => {
      return trackEvent('user_login', {
        custom_data: { method },
      });
    },
    [trackEvent]
  );

  /**
   * Track custom event
   */
  const trackCustomEvent = useCallback(
    (eventName: string, customData?: Record<string, any>) => {
      return trackEvent('custom', { custom_data: customData }, eventName);
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackPageView,
    trackProductView,
    trackAddToCart,
    trackRemoveFromCart,
    trackViewCart,
    trackBeginCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    trackSearch,
    trackSignup,
    trackLogin,
    trackCustomEvent,
  };
}

/**
 * DataLayer interface for global analytics
 * Mimics Google Tag Manager's dataLayer
 */
interface DataLayerEvent {
  event: string;
  [key: string]: any;
}

declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
  }
}

/**
 * Initialize global dataLayer
 */
export function initializeDataLayer() {
  if (typeof window !== 'undefined' && !window.dataLayer) {
    window.dataLayer = [];
  }
}

/**
 * Push event to dataLayer
 */
export function pushToDataLayer(event: DataLayerEvent) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
  }
}
