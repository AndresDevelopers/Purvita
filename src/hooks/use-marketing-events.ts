'use client';

import { useCallback } from 'react';
import type { Product } from '@/lib/models/definitions';
import {
  trackPurchase,
  trackAddToCart,
  trackViewContent,
  trackInitiateCheckout,
  trackCompleteRegistration,
  trackSearch,
  trackSubscribe,
  trackPageView,
  type ProductItem,
} from '@/lib/marketing/pixel-events';

/**
 * Hook for tracking marketing events
 * 
 * Provides a unified interface for tracking events across:
 * - Google Analytics 4
 * - Facebook Pixel
 * - TikTok Pixel
 * 
 * @example
 * const { trackProductView, trackCartAdd } = useMarketingEvents();
 * 
 * // Track product view
 * trackProductView(product);
 * 
 * // Track add to cart
 * trackCartAdd(product);
 */
export function useMarketingEvents() {
  /**
   * Track product view
   */
  const trackProductView = useCallback((product: Product, currency: string = 'USD') => {
    trackViewContent(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        category: (product as any).category || product.name,
      },
      currency
    );
  }, []);

  /**
   * Track add to cart
   */
  const trackCartAdd = useCallback((product: Product, currency: string = 'USD') => {
    trackAddToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        category: (product as any).category || product.name,
      },
      currency
    );
  }, []);

  /**
   * Track checkout initiation
   */
  const trackCheckoutStart = useCallback(
    (items: ProductItem[], totalValue: number, currency: string = 'USD') => {
      trackInitiateCheckout(totalValue, items, currency);
    },
    []
  );

  /**
   * Track completed purchase
   */
  const trackPurchaseComplete = useCallback(
    (orderId: string, items: ProductItem[], totalValue: number, currency: string = 'USD') => {
      trackPurchase(orderId, totalValue, currency, items);
    },
    []
  );

  /**
   * Track user registration
   */
  const trackUserRegistration = useCallback((method?: string) => {
    trackCompleteRegistration(method);
  }, []);

  /**
   * Track search query
   */
  const trackSearchQuery = useCallback((query: string) => {
    trackSearch(query);
  }, []);

  /**
   * Track subscription/plan purchase
   */
  const trackPlanSubscription = useCallback(
    (planId: string, planName: string, price: number, currency: string = 'USD') => {
      trackSubscribe(planId, planName, price, currency);
    },
    []
  );

  /**
   * Track page view (for SPA navigation)
   */
  const trackPage = useCallback((url: string, title?: string) => {
    trackPageView(url, title);
  }, []);

  return {
    trackProductView,
    trackCartAdd,
    trackCheckoutStart,
    trackPurchaseComplete,
    trackUserRegistration,
    trackSearchQuery,
    trackPlanSubscription,
    trackPage,
  };
}

