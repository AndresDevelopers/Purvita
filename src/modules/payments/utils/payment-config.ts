import type { PaymentProvider } from '../domain/models/payment-gateway';
import {
  GatewayCredentialsService,
  type GatewayCredentialEnvironment,
} from '../services/gateway-credentials-service';
import { PaymentConfigValidator } from './payment-config-validator';
import type { PaymentGatewayCredentials } from '../domain/models/payment-gateway';

export interface PaymentConfig {
  provider: PaymentProvider;
  isConfigured: boolean;
  missingFields: string[];
  environment: GatewayCredentialEnvironment;
}

const REQUIRED_FIELDS: Record<
  PaymentProvider,
  Record<GatewayCredentialEnvironment, Array<keyof PaymentGatewayCredentials>>
> = {
  paypal: {
    live: ['clientId', 'secret'],
    test: ['testClientId', 'testSecret'],
  },
  stripe: {
    live: ['publishableKey', 'secret'],
    test: ['testPublishableKey', 'testSecret'],
  },
  wallet: {
    live: [],
    test: [],
  },
  manual: { live: [], test: [] },
  authorize_net: {
    live: ['clientId', 'secret'],
    test: ['testClientId', 'testSecret'],
  },
  payoneer: {
    live: ['clientId', 'secret'],
    test: ['testClientId', 'testSecret'],
  },
};

export const validatePaymentConfig = async (
  provider: PaymentProvider,
  environment: GatewayCredentialEnvironment = 'live',
): Promise<PaymentConfig> => {
  try {
    const { record } = await GatewayCredentialsService.getProviderCredentials(provider, environment);
    const credentials = record.credentials;

    const requiredFields = REQUIRED_FIELDS[provider][environment];
    const missingFieldLabels = requiredFields
      .filter((field) => {
        const value = credentials[field];
        return !value || (typeof value === 'string' && value.trim() === '');
      })
      .map((field) => PaymentConfigValidator.getFieldDisplayName(field));

    return {
      provider,
      environment,
      isConfigured: record.status === 'active' && missingFieldLabels.length === 0,
      missingFields: missingFieldLabels,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Configuration missing';
    return {
      provider,
      environment,
      isConfigured: false,
      missingFields: [message],
    };
  }
};

export const getBaseUrl = (
  provider: PaymentProvider,
  environment: GatewayCredentialEnvironment = 'test',
): string => {
  if (provider === 'paypal') {
    return environment === 'test'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  if (provider === 'stripe') {
    return 'https://api.stripe.com';
  }

  return '';
};

export const getCredentials = async (
  provider: PaymentProvider,
  environment: GatewayCredentialEnvironment = 'test',
) => {
  const { credentials } = await GatewayCredentialsService.getActiveProviderCredentialsWithFallback(
    provider,
    environment,
  );

  return credentials;
};