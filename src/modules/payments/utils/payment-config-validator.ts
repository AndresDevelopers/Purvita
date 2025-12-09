import type { PaymentProvider, PaymentGatewayCredentials } from '../domain/models/payment-gateway';

export interface ValidationResult {
  isValid: boolean;
  missingFields: Array<keyof PaymentGatewayCredentials>;
  errors: string[];
}

export class PaymentConfigValidator {
  private static readonly REQUIRED_FIELDS: Record<PaymentProvider, Array<keyof PaymentGatewayCredentials>> = {
    stripe: ['publishableKey', 'secret'],
    paypal: ['clientId', 'secret'],
    wallet: [],
    manual: [],
    authorize_net: ['clientId', 'secret'],
    payoneer: ['clientId', 'secret'],
  };

  private static readonly FIELD_DISPLAY_NAMES: Record<keyof PaymentGatewayCredentials, string> = {
    mode: 'Mode',
    clientId: 'Client ID',
    publishableKey: 'Publishable Key',
    secret: 'Secret Key',
    webhookSecret: 'Webhook Secret',
    connectClientId: 'Connect Client ID',
    testClientId: 'Test Client ID',
    testPublishableKey: 'Test Publishable Key',
    testSecret: 'Test Secret Key',
    testWebhookSecret: 'Test Webhook Secret',
    testConnectClientId: 'Test Connect Client ID',
  };

  static validateCredentials(provider: PaymentProvider, credentials: PaymentGatewayCredentials): ValidationResult {
    const requiredFields = this.REQUIRED_FIELDS[provider];
    const missingFields: Array<keyof PaymentGatewayCredentials> = [];
    const errors: string[] = [];

    for (const field of requiredFields) {
      const value = credentials[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      const labels = missingFields.map((field) => this.FIELD_DISPLAY_NAMES[field] ?? field);
      errors.push(`Missing required fields: ${labels.join(', ')}`);
    }

    return {
      isValid: missingFields.length === 0 && errors.length === 0,
      missingFields,
      errors,
    };
  }

  static getFieldDisplayName(field: keyof PaymentGatewayCredentials): string {
    return this.FIELD_DISPLAY_NAMES[field] ?? field;
  }
}