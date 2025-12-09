import type { PaymentProvider } from '../domain/models/payment-gateway';

export const PAYMENT_TEST_CONSTANTS = {
  POPUP_DIMENSIONS: 'width=600,height=700,scrollbars=yes,resizable=yes',
  POPUP_CHECK_INTERVAL: 1000, // ms
  MAX_HISTORY_ITEMS: 100,
  DEFAULT_LIMIT: 20,
  TEST_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // ms
} as const;

export const PROVIDER_DISPLAY_NAMES: Record<PaymentProvider, string> = {
  paypal: 'PayPal',
  stripe: 'Stripe',
  wallet: 'Wallet',
  manual: 'Manual',
  authorize_net: 'Authorize.Net',
  payoneer: 'Payoneer',
} as const;

export const PAYMENT_ENVIRONMENTS = {
  PAYPAL: {
    SANDBOX: 'https://api-m.sandbox.paypal.com',
    LIVE: 'https://api-m.paypal.com',
  },
  STRIPE: {
    API: 'https://api.stripe.com',
  },
} as const;

export const TEST_AMOUNTS = {
  BASIC: 10.00,
  SUBSCRIPTION: 29.99,
  HIGH_VALUE: 999.99,
  MINIMAL: 0.50,
  MIN_ALLOWED: 0.01,
  MAX_ALLOWED: 10000.00,
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ERROR_MESSAGES = {
  CONFIGURATION_MISSING: 'Configuration is missing or invalid',
  INVALID_CREDENTIALS: 'Invalid credentials provided',
  NETWORK_ERROR: 'Network connection failed',
  POPUP_BLOCKED: 'Popup blocked. Please allow popups for payment testing',
  INVALID_AMOUNT: 'Invalid amount. Must be between $0.01 and $10,000.00',
  UNSUPPORTED_PROVIDER: 'Unsupported payment provider',
  ADMIN_ACCESS_REQUIRED: 'Admin access required',
  UNAUTHORIZED: 'Unauthorized access',
} as const;