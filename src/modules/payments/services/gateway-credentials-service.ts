import { createAdminClient } from '@/lib/supabase/server';
import { getEnv as _getEnv } from '@/lib/env';
import {
  PaymentGatewayCredentialsSchema,
  PaymentGatewayRecordSchema,
  type PaymentGatewayCredentials,
  type PaymentGatewayRecord,
  type PaymentProvider,
} from '../domain/models/payment-gateway';
import { PaymentError, PaymentErrorCode } from '../utils/payment-errors';
import type { PayPalCredentials, StripeCredentials } from '../types/payment-types';

export type GatewayCredentialEnvironment = 'live' | 'test';
export type GatewayCredentialRequestEnvironment = GatewayCredentialEnvironment | 'auto';

type ProviderCredentialMap = {
  paypal: PayPalCredentials;
  stripe: StripeCredentials;
  wallet: never;
  manual: never;
  authorize_net: Record<string, unknown>;
  payoneer: Record<string, unknown>;
};

const toGatewayCredentials = (input: Partial<Record<string, unknown>>): PaymentGatewayCredentials => {
  return PaymentGatewayCredentialsSchema.parse({
    clientId: input.clientId ?? input.client_id ?? null,
    publishableKey: input.publishableKey ?? input.publishable_key ?? null,
    secret: input.secret ?? input.secret_key ?? null,
    webhookSecret: input.webhookSecret ?? input.webhook_secret ?? null,
    testClientId: input.testClientId ?? input.test_client_id ?? null,
    testPublishableKey: input.testPublishableKey ?? input.test_publishable_key ?? null,
    testSecret: input.testSecret ?? input.test_secret ?? null,
    testWebhookSecret: input.testWebhookSecret ?? input.test_webhook_secret ?? null,
  });
};

const missingCredentialError = (
  provider: PaymentProvider,
  environment: GatewayCredentialEnvironment,
  field: string,
) =>
  new PaymentError(
    `Missing ${environment.toUpperCase()} credential for ${provider}: ${field}. Update the payment settings in the admin panel.`,
    provider,
    PaymentErrorCode.CONFIGURATION_MISSING,
    { provider, timestamp: new Date() },
  );

const mapPayPalCredentials = (
  credentials: PaymentGatewayCredentials,
  environment: GatewayCredentialEnvironment,
): PayPalCredentials => {
  const clientId = environment === 'test' ? credentials.testClientId : credentials.clientId;
  const clientSecret = environment === 'test' ? credentials.testSecret : credentials.secret;

  if (!clientId) {
    throw missingCredentialError('paypal', environment, 'clientId');
  }
  if (!clientSecret) {
    throw missingCredentialError('paypal', environment, 'secret');
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
  };
};

const mapStripeCredentials = (
  credentials: PaymentGatewayCredentials,
  environment: GatewayCredentialEnvironment,
): StripeCredentials => {
  const secretKey = environment === 'test' ? credentials.testSecret : credentials.secret;
  const publishableKey = environment === 'test'
    ? credentials.testPublishableKey
    : credentials.publishableKey;
  const webhookSecret = environment === 'test'
    ? credentials.testWebhookSecret
    : credentials.webhookSecret;

  if (!secretKey) {
    throw missingCredentialError('stripe', environment, 'secret');
  }

  return {
    secret_key: secretKey,
    publishable_key: publishableKey ?? undefined,
    webhook_secret: webhookSecret ?? undefined,
  };
};

const mapProviderCredentials = <T extends PaymentProvider>(
  provider: T,
  credentials: PaymentGatewayCredentials,
  environment: GatewayCredentialEnvironment,
): ProviderCredentialMap[T] => {
  switch (provider) {
    case 'paypal':
      return mapPayPalCredentials(credentials, environment) as ProviderCredentialMap[T];
    case 'stripe':
      return mapStripeCredentials(credentials, environment) as ProviderCredentialMap[T];
    case 'wallet':
      throw new PaymentError(`Unsupported payment provider: ${provider}`, provider);
    default:
      throw new PaymentError(`Unsupported payment provider: ${String(provider)}`, provider);
  }
};

export class GatewayCredentialsService {
  static normalizeInput(credentials: Record<string, unknown>): PaymentGatewayCredentials {
    return toGatewayCredentials(credentials);
  }

  /**
   * Fetch gateway record from database (only contains is_active, functionality, mode)
   * Credentials are now read from environment variables
   */
  private static async fetchGatewayRecord(provider: PaymentProvider): Promise<PaymentGatewayRecord> {
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('provider', provider)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw PaymentError.createConfigurationError(provider);
      }

      return PaymentGatewayRecordSchema.parse(data);
    } catch (error) {
      throw PaymentError.fromApiError(error, provider);
    }
  }

  /**
   * Read PayPal credentials from environment variables based on mode
   */
  private static getPayPalCredentialsFromEnv(mode: 'production' | 'test'): PayPalCredentials {
    // Read directly from process.env to avoid validation errors for unused credentials
    if (mode === 'test') {
      const clientId = process.env.PAYPAL_TEST_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_TEST_CLIENT_SECRET;
      const webhookSecret = process.env.PAYPAL_TEST_WEBHOOK_SECRET;
      const connectClientId = process.env.PAYPAL_TEST_CONNECT_CLIENT_ID;

      if (!clientId || !clientSecret) {
        throw new Error('PayPal test credentials not configured in environment variables');
      }

      return {
        client_id: clientId,
        client_secret: clientSecret,
        webhook_secret: webhookSecret,
        connect_client_id: connectClientId,
      };
    }

    // Production mode
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const webhookSecret = process.env.PAYPAL_WEBHOOK_SECRET;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const connectClientId = process.env.PAYPAL_CONNECT_CLIENT_ID;

    if (!clientId || !clientSecret) {
      throw new Error('PayPal production credentials not configured in environment variables');
    }

    return {
      client_id: clientId,
      client_secret: clientSecret,
      webhook_secret: webhookSecret,
      webhook_id: webhookId,
      connect_client_id: connectClientId,
    };
  }

  /**
   * Read Stripe credentials from environment variables based on mode
   */
  private static getStripeCredentialsFromEnv(mode: 'production' | 'test'): StripeCredentials {
    // Read directly from process.env to avoid validation errors for unused credentials
    if (mode === 'test') {
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY;
      const secretKey = process.env.STRIPE_TEST_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
      const connectClientId = process.env.STRIPE_TEST_CONNECT_CLIENT_ID;

      if (!publishableKey || !secretKey) {
        throw new Error('Stripe test credentials not configured in environment variables');
      }

      return {
        publishable_key: publishableKey,
        secret_key: secretKey,
        webhook_secret: webhookSecret,
        connect_client_id: connectClientId,
      };
    }

    // Production mode
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const connectClientId = process.env.STRIPE_CONNECT_CLIENT_ID;

    if (!publishableKey || !secretKey) {
      throw new Error('Stripe production credentials not configured in environment variables');
    }

    return {
      publishable_key: publishableKey,
      secret_key: secretKey,
      webhook_secret: webhookSecret,
      connect_client_id: connectClientId,
    };
  }

  /**
   * Read Authorize.net credentials from environment variables based on mode
   */
  private static getAuthorizeNetCredentialsFromEnv(mode: 'production' | 'test'): Record<string, string> {
    if (mode === 'test') {
      return {
        test_api_login_id: process.env.AUTHORIZE_NET_TEST_API_LOGIN_ID || '',
        test_transaction_key: process.env.AUTHORIZE_NET_TEST_TRANSACTION_KEY || '',
      };
    }
    return {
      api_login_id: process.env.AUTHORIZE_NET_API_LOGIN_ID || '',
      transaction_key: process.env.AUTHORIZE_NET_TRANSACTION_KEY || '',
    };
  }

  /**
   * Read Payoneer credentials from environment variables based on mode
   */
  private static getPayoneerCredentialsFromEnv(mode: 'production' | 'test'): Record<string, string> {
    if (mode === 'test') {
      return {
        test_api_username: process.env.PAYONEER_TEST_API_USERNAME || '',
        test_api_password: process.env.PAYONEER_TEST_API_PASSWORD || '',
        test_partner_id: process.env.PAYONEER_TEST_PARTNER_ID || '',
      };
    }
    return {
      api_username: process.env.PAYONEER_API_USERNAME || '',
      api_password: process.env.PAYONEER_API_PASSWORD || '',
      partner_id: process.env.PAYONEER_PARTNER_ID || '',
    };
  }

  static async getProviderCredentials<T extends PaymentProvider>(
    provider: T,
    environment: GatewayCredentialRequestEnvironment,
  ): Promise<{
    credentials: ProviderCredentialMap[T];
    record: PaymentGatewayRecord;
    requestedEnvironment: GatewayCredentialEnvironment;
  }> {
    const record = await this.fetchGatewayRecord(provider);

    // Determine the mode from database record
    let mode = record.mode || 'production';

    // AUTOMATIC MODE DETECTION:
    // If we are in production mode (default) but missing production credentials,
    // and we have test credentials, automatically switch to test mode.
    if (mode === 'production') {
      if (provider === 'paypal') {
        const hasProd = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;
        const hasTest = !!process.env.PAYPAL_TEST_CLIENT_ID && !!process.env.PAYPAL_TEST_CLIENT_SECRET;
        if (!hasProd && hasTest) {
          console.log('[GatewayCredentialsService] Auto-switching PayPal to TEST mode (Prod creds missing, Test creds found)');
          mode = 'test';
        }
      } else if (provider === 'stripe') {
        const hasProd = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !!process.env.STRIPE_SECRET_KEY;
        const hasTest = !!process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY && !!process.env.STRIPE_TEST_SECRET_KEY;
        if (!hasProd && hasTest) {
          console.log('[GatewayCredentialsService] Auto-switching Stripe to TEST mode (Prod creds missing, Test creds found)');
          mode = 'test';
        }
      } else if (provider === 'authorize_net') {
        const hasProd = !!process.env.AUTHORIZE_NET_API_LOGIN_ID && !!process.env.AUTHORIZE_NET_TRANSACTION_KEY;
        const hasTest = !!process.env.AUTHORIZE_NET_TEST_API_LOGIN_ID && !!process.env.AUTHORIZE_NET_TEST_TRANSACTION_KEY;
        if (!hasProd && hasTest) {
          console.log('[GatewayCredentialsService] Auto-switching Authorize.net to TEST mode');
          mode = 'test';
        }
      } else if (provider === 'payoneer') {
        const hasProd = !!process.env.PAYONEER_API_USERNAME && !!process.env.PAYONEER_API_PASSWORD;
        const hasTest = !!process.env.PAYONEER_TEST_API_USERNAME && !!process.env.PAYONEER_TEST_API_PASSWORD;
        if (!hasProd && hasTest) {
          console.log('[GatewayCredentialsService] Auto-switching Payoneer to TEST mode');
          mode = 'test';
        }
      }
    }

    // Resolve environment: 'auto' uses the mode from database (or auto-detected), otherwise use requested environment
    const resolvedEnvironment: GatewayCredentialEnvironment =
      environment === 'auto'
        ? mode === 'test'
          ? 'test'
          : 'live'
        : environment;

    // Read credentials from environment variables based on provider and mode
    let credentials: unknown;

    if (provider === 'paypal') {
      credentials = this.getPayPalCredentialsFromEnv(mode);
    } else if (provider === 'stripe') {
      credentials = this.getStripeCredentialsFromEnv(mode);
    } else if (provider === 'authorize_net') {
      credentials = this.getAuthorizeNetCredentialsFromEnv(mode);
    } else if (provider === 'payoneer') {
      credentials = this.getPayoneerCredentialsFromEnv(mode);
    } else if (provider === 'wallet' || provider === 'manual') {
      // Wallet and manual don't need external credentials
      credentials = {} as ProviderCredentialMap[T];
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return { credentials: credentials as ProviderCredentialMap[T], record, requestedEnvironment: resolvedEnvironment };
  }

  static async getActiveProviderCredentials<T extends PaymentProvider>(
    provider: T,
    environment: GatewayCredentialRequestEnvironment,
  ) {
    const result = await this.getProviderCredentials(provider, environment);

    if (result.record.status !== 'active') {
      throw missingCredentialError(provider, result.requestedEnvironment, 'status');
    }

    return result;
  }

  static async getActiveProviderCredentialsWithFallback<T extends PaymentProvider>(
    provider: T,
    preferredEnvironment: GatewayCredentialEnvironment = 'live',
  ) {
    const order: GatewayCredentialEnvironment[] =
      preferredEnvironment === 'live' ? ['live', 'test'] : ['test', 'live'];

    let lastError: unknown;

    for (const environment of order) {
      try {
        const result = await this.getActiveProviderCredentials(provider, environment);
        return { ...result, environment };
      } catch (error) {
        lastError = error;
      }
    }

    // Credentials must be configured in environment variables
    // Check .env.example for required variables
    throw PaymentError.fromApiError(lastError ?? new Error('Missing payment credentials in environment variables'), provider);
  }

  static resolveProvidedCredentials<T extends PaymentProvider>(
    provider: T,
    credentials: Record<string, unknown>,
    environment: GatewayCredentialEnvironment,
  ): ProviderCredentialMap[T] {
    const normalized = toGatewayCredentials(credentials);
    return mapProviderCredentials(provider, normalized, environment);
  }
}
