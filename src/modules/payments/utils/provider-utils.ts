import type { PaymentProvider } from '../domain/models/payment-gateway';

export const getProviderDisplayName = (provider: PaymentProvider): string => {
  const providerNames: Record<PaymentProvider, string> = {
    paypal: 'PayPal',
    stripe: 'Stripe',
    wallet: 'Wallet',
    manual: 'Manual',
    authorize_net: 'Authorize.Net',
    payoneer: 'Payoneer',
  };

  return providerNames[provider];
};

export const getProviderTestConfig = (provider: PaymentProvider) => {
  const configs: Record<
    PaymentProvider,
    { popupDimensions: string | null; testEnvironmentUrl: string | null }
  > = {
    paypal: {
      popupDimensions: 'width=600,height=700,scrollbars=yes,resizable=yes',
      testEnvironmentUrl: 'https://api-m.sandbox.paypal.com',
    },
    stripe: {
      popupDimensions: 'width=500,height=600,scrollbars=yes,resizable=yes',
      testEnvironmentUrl: 'https://api.stripe.com',
    },
    wallet: {
      popupDimensions: null,
      testEnvironmentUrl: null,
    },
    manual: { popupDimensions: '', testEnvironmentUrl: '' },
    authorize_net: {
      popupDimensions: 'width=600,height=700,scrollbars=yes,resizable=yes',
      testEnvironmentUrl: 'https://apitest.authorize.net',
    },
    payoneer: {
      popupDimensions: 'width=600,height=700,scrollbars=yes,resizable=yes',
      testEnvironmentUrl: 'https://api.sandbox.payoneer.com',
    },
  };

  return configs[provider];
};

export const PAYMENT_TEST_CONSTANTS = {
  MAX_TEST_RESULTS: 10,
  POPUP_CHECK_INTERVAL: 1000,
  DEFAULT_TEST_AMOUNT: 10.00,
  DEFAULT_CURRENCY: 'USD',
} as const;
