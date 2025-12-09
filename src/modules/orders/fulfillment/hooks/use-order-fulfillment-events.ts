'use client';

import { useEffect } from 'react';
import type {
  OrderFulfillmentEventBus,
  OrderFulfillmentObserver,
} from '../domain/events/order-fulfillment-event-bus';

export const useOrderFulfillmentEvents = (
  eventBus: OrderFulfillmentEventBus,
  observer: OrderFulfillmentObserver,
) => {
  useEffect(() => eventBus.subscribe(observer), [eventBus, observer]);
};
