import type { PaymentProvider } from '../domain/models/payment-gateway';
import type { PAYMENT_CONSTANTS } from '../constants/payment-constants';

export type PaymentCredentials = Record<string, string | undefined>;

export interface PayPalCredentials extends PaymentCredentials {
  client_id: string;
  client_secret: string;
}

export interface StripeCredentials extends PaymentCredentials {
  secret_key: string;
  publishable_key?: string;
}

export interface TestPaymentRequest {
  amount: number;
  currency: string;
  description: string;
  scenario?: string;
}

export interface TestPaymentResult {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  sessionId?: string;
  testId: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  description: string;
  timestamp: string;
  environment: keyof typeof PAYMENT_CONSTANTS.ENVIRONMENTS;
}

export interface ValidationResult {
  isValid: boolean;
  environment: keyof typeof PAYMENT_CONSTANTS.ENVIRONMENTS;
  errors?: string[];
}

export interface PaymentGatewaySettings {
  credentials: PaymentCredentials;
  is_active: boolean;
}