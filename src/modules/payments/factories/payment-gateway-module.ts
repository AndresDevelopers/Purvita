import { PaymentGatewayEventBus } from '../domain/events/payment-gateway-event-bus';
import type { PaymentGatewayRepository } from '../domain/contracts/payment-gateway-repository';
import { HttpPaymentGatewayRepository } from '../data/repositories/http-payment-gateway-repository';

export interface PaymentGatewayModule {
  repository: PaymentGatewayRepository;
  eventBus: PaymentGatewayEventBus;
}

export interface PaymentGatewayModuleOverrides {
  repository?: PaymentGatewayRepository;
  eventBus?: PaymentGatewayEventBus;
}

export const createPaymentGatewayModule = (
  overrides: PaymentGatewayModuleOverrides = {},
): PaymentGatewayModule => {
  const repository = overrides.repository ?? new HttpPaymentGatewayRepository();
  const eventBus = overrides.eventBus ?? new PaymentGatewayEventBus();

  return {
    repository,
    eventBus,
  };
};
