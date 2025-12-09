import type { OrderFulfillmentSnapshot } from '../models/order-fulfillment';

export type OrderFulfillmentLoadMode = 'initial' | 'refresh' | 'change';

export type OrderFulfillmentEvent =
  | { type: 'orders_loading'; date: string; mode: OrderFulfillmentLoadMode }
  | { type: 'orders_loaded'; snapshot: OrderFulfillmentSnapshot; mode: OrderFulfillmentLoadMode }
  | { type: 'orders_error'; error: Error; mode: OrderFulfillmentLoadMode };

export type OrderFulfillmentObserver = (event: OrderFulfillmentEvent) => void;

export class OrderFulfillmentEventBus {
  private observers = new Set<OrderFulfillmentObserver>();

  subscribe(observer: OrderFulfillmentObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  emit(event: OrderFulfillmentEvent) {
    for (const observer of this.observers) {
      observer(event);
    }
  }
}
