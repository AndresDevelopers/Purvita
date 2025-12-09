import { createPaymentGatewayModule, type PaymentGatewayModule } from './payment-gateway-module';

/**
 * Singleton instance of the payment gateway module.
 * This ensures that all components share the same event bus instance,
 * allowing them to communicate about payment gateway updates.
 *
 * Note: Using globalThis to ensure singleton persists across HMR in development
 */
const SINGLETON_KEY = '__PAYMENT_GATEWAY_MODULE_SINGLETON__' as const;

type GlobalWithSingleton = typeof globalThis & {
  [SINGLETON_KEY]?: PaymentGatewayModule;
};

export const getPaymentGatewayModule = (): PaymentGatewayModule => {
  const global = globalThis as GlobalWithSingleton;

  if (!global[SINGLETON_KEY]) {
    global[SINGLETON_KEY] = createPaymentGatewayModule();
  }

  return global[SINGLETON_KEY];
};

/**
 * Reset the singleton instance (useful for testing)
 */
export const resetPaymentGatewayModule = (): void => {
  const global = globalThis as GlobalWithSingleton;
  delete global[SINGLETON_KEY];
};

