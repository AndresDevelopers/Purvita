'use client';

import { useCallback } from 'react';
import type {
  OrderFulfillmentEventBus,
  OrderFulfillmentObserver,
} from '../domain/events/order-fulfillment-event-bus';
import { useOrderFulfillmentEvents } from './use-order-fulfillment-events';

const vibrate = (pattern: number | number[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!('vibrate' in navigator)) {
    return;
  }

  navigator.vibrate(pattern);
};

export const useOrderFulfillmentHaptics = (eventBus: OrderFulfillmentEventBus) => {
  const observer = useCallback<OrderFulfillmentObserver>((event) => {
    if (event.type === 'orders_loaded') {
      vibrate(12);
    }
    if (event.type === 'orders_error') {
      vibrate([20, 40, 20]);
    }
  }, []);

  useOrderFulfillmentEvents(eventBus, observer);
};
