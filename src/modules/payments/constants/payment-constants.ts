export const PAYMENT_CONSTANTS = {
  AMOUNTS: {
    MIN_AMOUNT: 0.01,
    MULTIPLIER_CENTS: 100,
  },
  URLS: {
    PAYPAL: {
      SANDBOX: 'https://api-m.sandbox.paypal.com',
      LIVE: 'https://api-m.paypal.com',
    },
    STRIPE: {
      API: 'https://api.stripe.com',
    },
  },
  TIMEOUTS: {
    API_REQUEST: 30000, // 30 seconds
    POPUP_TIMEOUT: 300000, // 5 minutes
  },
  CURRENCIES: {
    DEFAULT: 'USD',
    SUPPORTED: ['USD', 'EUR', 'GBP'] as const,
  },
  ENVIRONMENTS: {
    SANDBOX: 'sandbox',
    TEST: 'test',
    LIVE: 'live',
  } as const,
} as const;

export const TEST_SCENARIOS = [
  { 
    id: 'basic', 
    name: 'Pago Básico', 
    amount: '10.00', 
    description: 'Pago de prueba básico' 
  },
  { 
    id: 'subscription', 
    name: 'Suscripción', 
    amount: '29.99', 
    description: 'Prueba de suscripción mensual' 
  },
  { 
    id: 'high-value', 
    name: 'Alto Valor', 
    amount: '999.99', 
    description: 'Transacción de alto valor' 
  },
  { 
    id: 'custom', 
    name: 'Personalizado', 
    amount: '', 
    description: 'Prueba personalizada' 
  },
] as const;

export type TestScenarioId = typeof TEST_SCENARIOS[number]['id'];