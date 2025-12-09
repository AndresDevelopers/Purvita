import {
  OrderFulfillmentRequestSchema,
  type OrderFulfillmentSnapshot,
} from '../domain/models/order-fulfillment';
import {
  OrderFulfillmentEventBus,
  type OrderFulfillmentLoadMode,
} from '../domain/events/order-fulfillment-event-bus';
import type { OrderFulfillmentRepository } from '../repositories/order-fulfillment-repository';

export class OrderFulfillmentService {
  constructor(
    private readonly repository: OrderFulfillmentRepository,
    private readonly eventBus: OrderFulfillmentEventBus,
  ) {}

  async loadDay(date: string, mode: OrderFulfillmentLoadMode = 'initial'): Promise<OrderFulfillmentSnapshot> {
    const params = OrderFulfillmentRequestSchema.parse({ date });

    this.eventBus.emit({ type: 'orders_loading', date: params.date, mode });

    try {
      const snapshot = await this.repository.fetchDailyOrders(params);
      this.eventBus.emit({ type: 'orders_loaded', snapshot, mode });
      return snapshot;
    } catch (error) {
      const safeError = error instanceof Error
        ? error
        : new Error('[OrderFulfillmentService] Failed to load fulfillment data');
      this.eventBus.emit({ type: 'orders_error', error: safeError, mode });
      throw safeError;
    }
  }
}
