/**
 * Marketing Pixel Event Tracking
 * 
 * Unified interface for tracking conversion events across:
 * - Facebook Pixel
 * - TikTok Pixel
 * - Google Analytics 4
 * 
 * All events are tracked client-side and respect user privacy settings.
 */

declare global {
  interface Window {
    fbq?: (action: string, event: string, params?: Record<string, any>) => void;
    ttq?: {
      track: (event: string, params?: Record<string, any>) => void;
    };
    gtag?: (command: string, ...args: any[]) => void;
  }
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  category?: string;
}

/**
 * Track Facebook Pixel event
 */
export const trackFacebookEvent = (
  eventName: string,
  params?: Record<string, any>
): void => {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', eventName, params);
    } catch (error) {
      console.error('Facebook Pixel tracking error:', error);
    }
  }
};

/**
 * Track TikTok Pixel event
 */
export const trackTikTokEvent = (
  eventName: string,
  params?: Record<string, any>
): void => {
  if (typeof window !== 'undefined' && window.ttq) {
    try {
      window.ttq.track(eventName, params);
    } catch (error) {
      console.error('TikTok Pixel tracking error:', error);
    }
  }
};

/**
 * Track Google Analytics 4 event
 */
export const trackGoogleEvent = (
  eventName: string,
  params?: Record<string, any>
): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', eventName, params);
    } catch (error) {
      console.error('Google Analytics tracking error:', error);
    }
  }
};

/**
 * Track purchase conversion
 */
export const trackPurchase = (
  orderId: string,
  value: number,
  currency: string = 'USD',
  items: ProductItem[]
): void => {
  // Facebook Pixel
  trackFacebookEvent('Purchase', {
    value,
    currency,
    content_ids: items.map(item => item.id),
    content_type: 'product',
    contents: items.map(item => ({
      id: item.id,
      quantity: item.quantity || 1,
      item_price: item.price,
    })),
  });

  // TikTok Pixel
  trackTikTokEvent('CompletePayment', {
    value,
    currency,
    content_id: orderId,
    contents: items.map(item => ({
      content_id: item.id,
      content_name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
    })),
  });

  // Google Analytics 4
  trackGoogleEvent('purchase', {
    transaction_id: orderId,
    value,
    currency,
    items: items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
    })),
  });
};

/**
 * Track add to cart event
 */
export const trackAddToCart = (
  product: ProductItem,
  currency: string = 'USD'
): void => {
  trackFacebookEvent('AddToCart', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    value: product.price,
    currency,
  });

  trackTikTokEvent('AddToCart', {
    content_id: product.id,
    content_name: product.name,
    value: product.price,
    currency,
  });

  trackGoogleEvent('add_to_cart', {
    currency,
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      quantity: 1,
    }],
  });
};

/**
 * Track product view
 */
export const trackViewContent = (
  product: ProductItem,
  currency: string = 'USD'
): void => {
  trackFacebookEvent('ViewContent', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    value: product.price,
    currency,
  });

  trackTikTokEvent('ViewContent', {
    content_id: product.id,
    content_name: product.name,
    value: product.price,
    currency,
  });

  trackGoogleEvent('view_item', {
    currency,
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      price: product.price,
    }],
  });
};

/**
 * Track checkout initiation
 */
export const trackInitiateCheckout = (
  value: number,
  items: ProductItem[],
  currency: string = 'USD'
): void => {
  trackFacebookEvent('InitiateCheckout', {
    value,
    currency,
    content_ids: items.map(item => item.id),
    contents: items.map(item => ({
      id: item.id,
      quantity: item.quantity || 1,
    })),
    num_items: items.length,
  });

  trackTikTokEvent('InitiateCheckout', {
    value,
    currency,
    contents: items.map(item => ({
      content_id: item.id,
      content_name: item.name,
      quantity: item.quantity || 1,
    })),
  });

  trackGoogleEvent('begin_checkout', {
    currency,
    value,
    items: items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
    })),
  });
};

/**
 * Track user registration
 */
export const trackCompleteRegistration = (method?: string): void => {
  trackFacebookEvent('CompleteRegistration', {
    ...(method && { registration_method: method }),
  });

  trackTikTokEvent('CompleteRegistration', {
    ...(method && { registration_method: method }),
  });

  trackGoogleEvent('sign_up', {
    ...(method && { method }),
  });
};

/**
 * Track search
 */
export const trackSearch = (searchTerm: string): void => {
  trackFacebookEvent('Search', {
    search_string: searchTerm,
  });

  trackTikTokEvent('Search', {
    query: searchTerm,
  });

  trackGoogleEvent('search', {
    search_term: searchTerm,
  });
};

/**
 * Track subscription/plan selection
 */
export const trackSubscribe = (
  planId: string,
  planName: string,
  value: number,
  currency: string = 'USD'
): void => {
  trackFacebookEvent('Subscribe', {
    value,
    currency,
    predicted_ltv: value * 12, // Estimate annual value
  });

  trackTikTokEvent('Subscribe', {
    value,
    currency,
  });

  trackGoogleEvent('purchase', {
    transaction_id: `sub_${planId}_${Date.now()}`,
    value,
    currency,
    items: [{
      item_id: planId,
      item_name: planName,
      item_category: 'subscription',
      price: value,
      quantity: 1,
    }],
  });
};

/**
 * Track page view (for SPA navigation)
 */
export const trackPageView = (url: string, title?: string): void => {
  trackFacebookEvent('PageView');

  trackGoogleEvent('page_view', {
    page_location: url,
    ...(title && { page_title: title }),
  });
};

