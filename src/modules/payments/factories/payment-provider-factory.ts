import type { PaymentProvider } from '../domain/models/payment-gateway';
import type { PaymentRequest, PaymentResponse } from '../services/payment-service';

export interface PaymentProviderConfig {
  endpoint: string;
  buildPayload: (request: PaymentRequest) => Record<string, any>;
  extractUrl: (response: PaymentResponse) => string | null;
  getTestInfo: () => string[];
}

export class PaymentProviderFactory {
  private static configs: Record<PaymentProvider, PaymentProviderConfig> = {
    paypal: {
      endpoint: '/api/payments/paypal/create-order',
      buildPayload: (request) => ({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        isTest: request.isTest,
        successUrl: request.successUrl,
        cancelUrl: request.cancelUrl,
        originUrl: request.originUrl,
        metadata: request.metadata,
      }),
      extractUrl: (response) => response.approvalUrl || null,
      getTestInfo: () => [
        'Use PayPal sandbox credentials for testing',
        'Test payments won\'t charge real money',
        'You can use PayPal test accounts to simulate payments',
        'Check your PayPal developer dashboard for logs'
      ],
    },
    stripe: {
      endpoint: '/api/payments/stripe/create-checkout',
      buildPayload: (request) => ({
        amount: Math.round(request.amount * 100), // Convert to cents
        currency: request.currency.toLowerCase(),
        description: request.description,
        isTest: request.isTest,
        successUrl: request.successUrl,
        cancelUrl: request.cancelUrl,
        originUrl: request.originUrl,
        metadata: request.metadata,
      }),
      extractUrl: (response) => response.url || null,
      getTestInfo: () => [
        'Use test card: 4242 4242 4242 4242',
        'Expiry: Any future date (e.g., 12/34)',
        'CVC: Any 3 digits (e.g., 123)',
        'Check your Stripe dashboard for transaction logs'
      ],
    },
    wallet: {
      endpoint: '/api/payments/wallet/charge',
      buildPayload: (request) => ({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        metadata: request.metadata,
        cartItems: request.cartItems,
      }),
      extractUrl: () => null,
      getTestInfo: () => [
        'Ensure your personal balance covers the full amount before testing.',
        'Wallet payments deduct funds instantly with no external redirects.',
        'You can review wallet transactions in the wallet history screen.',
      ],
    },
    authorize_net: {
      endpoint: '/api/payments/authorize-net/create-transaction',
      buildPayload: (request) => ({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        isTest: request.isTest,
        metadata: request.metadata,
      }),
      extractUrl: () => null,
      getTestInfo: () => [
        'Use Authorize.net sandbox credentials',
        'Test card: 4111 1111 1111 1111',
        'Expiration: Any future date',
        'CVV: Any 3 digits',
      ],
    },
    payoneer: {
      endpoint: '/api/payments/payoneer/create-payout',
      buildPayload: (request) => ({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        isTest: request.isTest,
        metadata: request.metadata,
      }),
      extractUrl: () => null,
      getTestInfo: () => [
        'Use Payoneer sandbox credentials',
        'Payouts are processed asynchronously',
      ],
    },
    manual: { endpoint: '', buildPayload: () => ({} as any), extractUrl: () => '', getTestInfo: () => [] },
  };

  static getConfig(provider: PaymentProvider): PaymentProviderConfig {
    const config = this.configs[provider];
    if (!config) {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
    return config;
  }

  static getSupportedProviders(): PaymentProvider[] {
    return Object.keys(this.configs) as PaymentProvider[];
  }
}