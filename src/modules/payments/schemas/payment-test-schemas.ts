import { z } from 'zod';
import { TEST_AMOUNTS } from '../constants/test-constants';

export const PaymentProviderSchema = z.enum(['paypal', 'stripe', 'wallet']);

export const TestStatusSchema = z.enum(['pending', 'success', 'failed', 'cancelled']);

export const TestScenarioIdSchema = z.enum(['basic', 'subscription', 'highValue', 'minimal', 'custom']);

export const PaymentTestRequestSchema = z.object({
  amount: z.number()
    .min(TEST_AMOUNTS.MIN_ALLOWED, `Amount must be at least $${TEST_AMOUNTS.MIN_ALLOWED}`)
    .max(TEST_AMOUNTS.MAX_ALLOWED, `Amount cannot exceed $${TEST_AMOUNTS.MAX_ALLOWED}`),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('USD'),
  description: z.string().min(1, 'Description is required').max(255, 'Description too long'),
  scenario: z.string().optional().default('basic'),
});

export const TestHistoryItemSchema = z.object({
  id: z.string(),
  provider: PaymentProviderSchema,
  scenario: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  status: TestStatusSchema,
  description: z.string(),
  paymentUrl: z.string().url().optional(),
  orderId: z.string().optional(),
  sessionId: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  debugInfo: z.record(z.any()).optional(),
});

export const PaymentCredentialsSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('paypal'),
    clientId: z.string().min(1, 'PayPal Client ID is required'),
    clientSecret: z.string().min(1, 'PayPal Client Secret is required'),
  }),
  z.object({
    provider: z.literal('stripe'),
    publishableKey: z.string().startsWith('pk_', 'Invalid Stripe publishable key format'),
    secretKey: z.string().startsWith('sk_', 'Invalid Stripe secret key format'),
    webhookSecret: z.string().optional(),
  }),
  z.object({
    provider: z.literal('wallet'),
  }),
]);

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  details: z.record(z.any()).optional(),
});

export const TestFormParamsSchema = z.object({
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= TEST_AMOUNTS.MIN_ALLOWED && num <= TEST_AMOUNTS.MAX_ALLOWED;
    },
    {
      message: `Amount must be between $${TEST_AMOUNTS.MIN_ALLOWED} and $${TEST_AMOUNTS.MAX_ALLOWED}`,
    }
  ),
  description: z.string().min(1, 'Description is required'),
  scenarioName: z.string().min(1, 'Scenario name is required'),
});

// Type exports
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;
export type TestStatus = z.infer<typeof TestStatusSchema>;
export type TestScenarioId = z.infer<typeof TestScenarioIdSchema>;
export type PaymentTestRequest = z.infer<typeof PaymentTestRequestSchema>;
export type TestHistoryItem = z.infer<typeof TestHistoryItemSchema>;
export type PaymentCredentials = z.infer<typeof PaymentCredentialsSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type TestFormParams = z.infer<typeof TestFormParamsSchema>;