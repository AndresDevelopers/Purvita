import { OrderFulfillmentEventBus } from '../domain/events/order-fulfillment-event-bus';
import { OrderFulfillmentRepositoryFactory } from '../repositories/order-fulfillment-repository';
import { OrderFulfillmentService } from '../services/order-fulfillment-service';

export interface OrderFulfillmentModule {
  service: OrderFulfillmentService;
  eventBus: OrderFulfillmentEventBus;
}

class OrderFulfillmentModuleFactoryImpl {
  private eventBus: OrderFulfillmentEventBus | null = null;
  private service: OrderFulfillmentService | null = null;

  create(): OrderFulfillmentModule {
    if (!this.eventBus) {
      this.eventBus = new OrderFulfillmentEventBus();
    }

    if (!this.service) {
      const repository = OrderFulfillmentRepositoryFactory.create();
      this.service = new OrderFulfillmentService(repository, this.eventBus);
    }

    return {
      service: this.service,
      eventBus: this.eventBus,
    };
  }
}

export const OrderFulfillmentModuleFactory = new OrderFulfillmentModuleFactoryImpl();
