'use client';

import { useEffect } from 'react';
import type { PaymentHistoryEventBus, PaymentHistoryObserver } from '../domain/events/payment-history-event-bus';

export const usePaymentHistoryEvents = (
  eventBus: PaymentHistoryEventBus,
  observer: PaymentHistoryObserver | null | undefined,
) => {
  useEffect(() => {
    if (!observer) {
      return undefined;
    }

    const unsubscribe = eventBus.subscribe(observer);
    return () => unsubscribe();
  }, [eventBus, observer]);
};
