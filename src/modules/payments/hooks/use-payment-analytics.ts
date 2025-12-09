import { useCallback } from 'react';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentAnalyticsEvent {
  provider: PaymentProvider;
  action: 'test_initiated' | 'test_completed' | 'test_failed' | 'config_updated';
  amount?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export const usePaymentAnalytics = () => {
  const trackEvent = useCallback((event: PaymentAnalyticsEvent) => {
    // In a real app, this would send to analytics service
    console.log('Payment Analytics:', {
      ...event,
      timestamp: new Date().toISOString(),
    });

    // Example: Send to Google Analytics, Mixpanel, etc.
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', event.action, {
        event_category: 'payment',
        event_label: event.provider,
        value: event.amount,
        custom_parameter_error: event.error,
      });
    }
  }, []);

  const trackTestPayment = useCallback((
    provider: PaymentProvider,
    amount: number,
    success: boolean,
    error?: string
  ) => {
    trackEvent({
      provider,
      action: success ? 'test_completed' : 'test_failed',
      amount,
      error,
    });
  }, [trackEvent]);

  const trackConfigUpdate = useCallback((
    provider: PaymentProvider,
    isActive: boolean
  ) => {
    trackEvent({
      provider,
      action: 'config_updated',
      metadata: { isActive },
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackTestPayment,
    trackConfigUpdate,
  };
};