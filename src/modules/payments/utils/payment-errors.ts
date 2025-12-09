import type { PaymentProvider } from '../domain/models/payment-gateway';
import { ERROR_MESSAGES } from '../constants/test-constants';

export enum PaymentErrorCode {
  CONFIGURATION_MISSING = 'CONFIGURATION_MISSING',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  POPUP_BLOCKED = 'POPUP_BLOCKED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface PaymentErrorContext {
  provider?: PaymentProvider;
  testId?: string;
  scenario?: string;
  amount?: number;
  timestamp?: Date;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly provider: PaymentProvider,
    public readonly code?: PaymentErrorCode,
    public readonly context?: PaymentErrorContext,
    public readonly isRetryable: boolean = false,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'PaymentError';
  }

  static isPaymentError(error: unknown): error is PaymentError {
    return error instanceof PaymentError;
  }

  static fromApiError(error: unknown, provider: PaymentProvider): PaymentError {
    if (error instanceof PaymentError) {
      return error;
    }

    if (error instanceof Error) {
      // Determine error code based on message patterns
      let code = PaymentErrorCode.UNKNOWN_ERROR;
      let isRetryable = false;

      const message = error.message.toLowerCase();

      if (message.includes('credentials') || message.includes('authentication') || message.includes('unauthorized')) {
        code = PaymentErrorCode.INVALID_CREDENTIALS;
      } else if (message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('connection')) {
        code = PaymentErrorCode.NETWORK_ERROR;
        isRetryable = true;
      } else if (message.includes('validation') || message.includes('invalid') || message.includes('bad request')) {
        code = PaymentErrorCode.VALIDATION_ERROR;
      } else if (message.includes('popup') || message.includes('blocked')) {
        code = PaymentErrorCode.POPUP_BLOCKED;
      } else if (message.includes('timeout')) {
        code = PaymentErrorCode.TIMEOUT_ERROR;
        isRetryable = true;
      } else if (message.includes('configuration') || message.includes('not configured')) {
        code = PaymentErrorCode.CONFIGURATION_MISSING;
      }

      return new PaymentError(
        error.message,
        provider,
        code,
        { provider, timestamp: new Date() },
        isRetryable,
        error
      );
    }

    // Handle AbortError from fetch timeouts
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return new PaymentError(
        'Request timeout',
        provider,
        PaymentErrorCode.TIMEOUT_ERROR,
        { provider, timestamp: new Date() },
        true,
        error
      );
    }

    return new PaymentError(
      'Unknown payment error',
      provider,
      PaymentErrorCode.UNKNOWN_ERROR,
      { provider, timestamp: new Date() },
      false,
      error
    );
  }

  static createConfigurationError(provider: PaymentProvider): PaymentError {
    return new PaymentError(
      ERROR_MESSAGES.CONFIGURATION_MISSING,
      provider,
      PaymentErrorCode.CONFIGURATION_MISSING,
      { provider, timestamp: new Date() },
      false
    );
  }

  static createCredentialsError(provider: PaymentProvider): PaymentError {
    return new PaymentError(
      ERROR_MESSAGES.INVALID_CREDENTIALS,
      provider,
      PaymentErrorCode.INVALID_CREDENTIALS,
      { provider, timestamp: new Date() },
      false
    );
  }

  static createNetworkError(provider: PaymentProvider): PaymentError {
    return new PaymentError(
      ERROR_MESSAGES.NETWORK_ERROR,
      provider,
      PaymentErrorCode.NETWORK_ERROR,
      { provider, timestamp: new Date() },
      true
    );
  }

  static createPopupBlockedError(provider: PaymentProvider): PaymentError {
    return new PaymentError(
      ERROR_MESSAGES.POPUP_BLOCKED,
      provider,
      PaymentErrorCode.POPUP_BLOCKED,
      { provider, timestamp: new Date() },
      false
    );
  }

  static createTimeoutError(provider: PaymentProvider): PaymentError {
    return new PaymentError(
      'Request timeout. Please try again.',
      provider,
      PaymentErrorCode.TIMEOUT_ERROR,
      { provider, timestamp: new Date() },
      true
    );
  }

  getUserFriendlyMessage(): string {
    switch (this.code) {
      case PaymentErrorCode.CONFIGURATION_MISSING:
        return `${this.provider} is not configured. Please check your settings.`;
      case PaymentErrorCode.INVALID_CREDENTIALS:
        return `Invalid ${this.provider} credentials. Please verify your API keys.`;
      case PaymentErrorCode.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection and try again.';
      case PaymentErrorCode.POPUP_BLOCKED:
        return 'Popup blocked. Please allow popups for payment testing.';
      case PaymentErrorCode.VALIDATION_ERROR:
        return this.message;
      case PaymentErrorCode.PROVIDER_ERROR:
        return `${this.provider} service error: ${this.message}`;
      case PaymentErrorCode.TIMEOUT_ERROR:
        return 'Request timed out. Please check your connection and try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

export const PAYMENT_ERROR_MESSAGES = {
  GENERIC_ERROR: 'An unexpected error occurred. Please try again.',
  CONFIGURATION_ERROR: 'Payment configuration is invalid. Please contact support.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  VALIDATION_ERROR: 'Invalid payment data. Please check your input.',
} as const;