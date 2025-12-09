import { GatewayCredentialsService, type GatewayCredentialEnvironment } from './gateway-credentials-service';
import { PaymentValidators } from './payment-validators';
import { PayPalService } from './payment-providers/paypal-service';
import { StripeService } from './payment-providers/stripe-service';
import { PaymentError, PaymentErrorCode } from '../utils/payment-errors';
import type { PaymentProvider } from '../domain/models/payment-gateway';
import type {
  TestPaymentRequest,
  TestPaymentResult,
  PayPalCredentials,
  StripeCredentials,
  ValidationResult,
} from '../types/payment-types';

export class PaymentTestingService {
  /**
   * Creates a test payment for the specified provider
   */
  static async createTestPayment(
    provider: PaymentProvider,
    request: TestPaymentRequest,
    credentials?: Record<string, unknown>,
    originUrl?: string,
  ): Promise<TestPaymentResult> {
    try {
      const resolvedCredentials = credentials
        ? GatewayCredentialsService.resolveProvidedCredentials(provider, credentials, 'test')
        : await this.getCredentials(provider, 'test');

      switch (provider) {
        case 'paypal':
          return await PayPalService.createTestPayment(resolvedCredentials as PayPalCredentials, request, originUrl);
        case 'stripe':
          return await StripeService.createTestPayment(resolvedCredentials as StripeCredentials, request, originUrl);
        default:
          throw PaymentError.fromApiError(new Error(`Unsupported provider: ${provider}`), provider);
      }
    } catch (error) {
      throw PaymentError.fromApiError(error, provider);
    }
  }

  /**
   * Retrieves payment gateway credentials from database
   */
  static async getCredentials(provider: PaymentProvider, environment: GatewayCredentialEnvironment = 'live') {
    const { credentials, record } = await GatewayCredentialsService.getProviderCredentials(provider, environment);

    if (record.status !== 'active') {
      throw new PaymentError(
        `${provider} gateway is not active`,
        provider,
        PaymentErrorCode.CONFIGURATION_MISSING,
        { provider, timestamp: new Date() },
      );
    }

    return credentials;
  }

  /**
   * Validates payment provider credentials
   */
  static async validateCredentials(
    provider: PaymentProvider,
    credentials?: Record<string, unknown>,
    environment: GatewayCredentialEnvironment = 'live',
  ): Promise<ValidationResult> {
    try {
      const resolvedCredentials = credentials
        ? GatewayCredentialsService.resolveProvidedCredentials(provider, credentials, environment)
        : await this.getCredentials(provider, environment);

      switch (provider) {
        case 'paypal':
          return await PaymentValidators.validatePayPal(resolvedCredentials as PayPalCredentials);
        case 'stripe':
          return await PaymentValidators.validateStripe(resolvedCredentials as StripeCredentials);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      throw PaymentError.fromApiError(error, provider);
    }
  }
}
