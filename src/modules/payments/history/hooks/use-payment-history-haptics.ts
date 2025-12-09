'use client';

import { useCallback } from 'react';
import type { PaymentHistoryEventBus, PaymentHistoryObserver } from '../domain/events/payment-history-event-bus';
import { usePaymentHistoryEvents } from './use-payment-history-events';

const vibrate = (pattern: number | number[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!('vibrate' in navigator)) {
    return;
  }

  navigator.vibrate(pattern);
};

export const usePaymentHistoryHaptics = (eventBus: PaymentHistoryEventBus) => {
  const observer = useCallback<PaymentHistoryObserver>((event) => {
    if (event.type === 'entry_added') {
      vibrate([12, 18]);
    }
    if (event.type === 'entry_updated') {
      vibrate(12);
    }
    if (event.type === 'history_error') {
      vibrate([16, 32, 16]);
    }
  }, []);

  usePaymentHistoryEvents(eventBus, observer);
};
