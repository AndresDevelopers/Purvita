import { PaymentHistoryEventBus } from '../domain/events/payment-history-event-bus';
import { PaymentHistoryRepositoryFactory } from '../repositories/payment-history-repository';
import { PaymentHistoryService } from '../services/payment-history-service';

export interface PaymentHistoryModule {
  service: PaymentHistoryService;
  eventBus: PaymentHistoryEventBus;
}

class PaymentHistoryModuleFactoryImpl {
  private eventBus: PaymentHistoryEventBus | null = null;
  private service: PaymentHistoryService | null = null;

  create(): PaymentHistoryModule {
    if (!this.eventBus) {
      this.eventBus = new PaymentHistoryEventBus();
    }

    if (!this.service) {
      const repository = PaymentHistoryRepositoryFactory.create();
      this.service = new PaymentHistoryService(repository, this.eventBus);
    }

    return {
      service: this.service,
      eventBus: this.eventBus,
    };
  }
}

export const PaymentHistoryModuleFactory = new PaymentHistoryModuleFactoryImpl();
