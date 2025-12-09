import { z } from 'zod';

export const PaymentProviderSchema = z.enum(['paypal', 'stripe', 'wallet', 'manual', 'authorize_net', 'payoneer']);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

export const PaymentFunctionalitySchema = z.enum(['payment', 'payout', 'both']);
export type PaymentFunctionality = z.infer<typeof PaymentFunctionalitySchema>;

export const PaymentGatewayStatusSchema = z.enum(['active', 'inactive']);
export type PaymentGatewayStatus = z.infer<typeof PaymentGatewayStatusSchema>;

export const PaymentGatewayModeSchema = z.enum(['production', 'test']);
export type PaymentGatewayMode = z.infer<typeof PaymentGatewayModeSchema>;

const normalizeMode = (mode?: PaymentGatewayMode | null): PaymentGatewayMode =>
  mode === 'test' ? 'test' : 'production';

export const PaymentGatewayCredentialsSchema = z
  .object({
    clientId: z.string().nullable().optional(),
    publishableKey: z.string().nullable().optional(),
    secret: z.string().nullable().optional(),
    webhookSecret: z.string().nullable().optional(),
    connectClientId: z.string().nullable().optional(), // Stripe Connect Client ID (ca_xxx)
    testClientId: z.string().nullable().optional(),
    testPublishableKey: z.string().nullable().optional(),
    testSecret: z.string().nullable().optional(),
    testWebhookSecret: z.string().nullable().optional(),
    testConnectClientId: z.string().nullable().optional(), // Stripe Connect Test Client ID
    mode: PaymentGatewayModeSchema.optional(),
  })
  .transform((value) => ({
    clientId: value.clientId?.trim() || null,
    publishableKey: value.publishableKey?.trim() || null,
    secret: value.secret?.trim() || null,
    webhookSecret: value.webhookSecret?.trim() || null,
    connectClientId: value.connectClientId?.trim() || null,
    testClientId: value.testClientId?.trim() || null,
    testPublishableKey: value.testPublishableKey?.trim() || null,
    testSecret: value.testSecret?.trim() || null,
    testWebhookSecret: value.testWebhookSecret?.trim() || null,
    testConnectClientId: value.testConnectClientId?.trim() || null,
    mode: normalizeMode(value.mode),
  }));

export type PaymentGatewayCredentials = z.infer<typeof PaymentGatewayCredentialsSchema>;

export const PaymentGatewaySettingsSchema = z.object({
  provider: PaymentProviderSchema,
  status: PaymentGatewayStatusSchema,
  functionality: PaymentFunctionalitySchema.default('payment'),
  mode: PaymentGatewayModeSchema.default('production'),
  // Availability settings
  availableOnAffiliateCheckout: z.boolean().default(true),
  availableOnMlmCheckout: z.boolean().default(true),
  availableOnMainStore: z.boolean().default(true),
  // Credential fields are deprecated - credentials now come from environment variables
  clientId: z.string().nullable().optional(),
  publishableKey: z.string().nullable().optional(),
  hasSecret: z.boolean().default(false),
  hasWebhookSecret: z.boolean().default(false),
  secretPreview: z.string().nullable().optional(),
  webhookSecretPreview: z.string().nullable().optional(),
  connectClientId: z.string().nullable().optional(),
  testClientId: z.string().nullable().optional(),
  testPublishableKey: z.string().nullable().optional(),
  hasTestSecret: z.boolean().default(false),
  hasTestWebhookSecret: z.boolean().default(false),
  testSecretPreview: z.string().nullable().optional(),
  testWebhookSecretPreview: z.string().nullable().optional(),
  testConnectClientId: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export type PaymentGatewaySettings = z.infer<typeof PaymentGatewaySettingsSchema>;

export const PaymentGatewayUpdateInputSchema = z.object({
  provider: PaymentProviderSchema,
  status: PaymentGatewayStatusSchema,
  functionality: PaymentFunctionalitySchema.optional(),
  mode: PaymentGatewayModeSchema.optional(),
  // Availability settings
  availableOnAffiliateCheckout: z.boolean().optional(),
  availableOnMlmCheckout: z.boolean().optional(),
  availableOnMainStore: z.boolean().optional(),
  // Credential fields are deprecated - credentials now come from environment variables
  // Keeping them optional for backward compatibility during migration
  clientId: z.string().nullable().optional(),
  publishableKey: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  connectClientId: z.string().nullable().optional(),
  testClientId: z.string().nullable().optional(),
  testPublishableKey: z.string().nullable().optional(),
  testSecret: z.string().nullable().optional(),
  testWebhookSecret: z.string().nullable().optional(),
  testConnectClientId: z.string().nullable().optional(),
});

export type PaymentGatewayUpdateInput = z.infer<typeof PaymentGatewayUpdateInputSchema>;

export const PaymentGatewayPublicInfoSchema = z.object({
  provider: PaymentProviderSchema,
  mode: PaymentGatewayModeSchema.default('production'),
  functionality: PaymentFunctionalitySchema.default('payment'),
  clientId: z.string().nullable().optional(),
  publishableKey: z.string().nullable().optional(),
  // Availability settings
  availableOnAffiliateCheckout: z.boolean().default(true),
  availableOnMlmCheckout: z.boolean().default(true),
  availableOnMainStore: z.boolean().default(true),
  metadata: z
    .record(z.unknown())
    .optional()
    .transform((value) => (value && Object.keys(value).length === 0 ? undefined : value)),
});

export type PaymentGatewayPublicInfo = z.infer<typeof PaymentGatewayPublicInfoSchema>;

export const PaymentGatewayRecordSchema = z
  .object({
    id: z.string().uuid().optional(),
    provider: PaymentProviderSchema,
    is_active: z.coerce.boolean().default(false),
    functionality: PaymentFunctionalitySchema.default('payment'),
    mode: PaymentGatewayModeSchema.default('production'),
    // Availability settings
    available_on_affiliate_checkout: z.coerce.boolean().default(true),
    available_on_mlm_checkout: z.coerce.boolean().default(true),
    available_on_main_store: z.coerce.boolean().default(true),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    // credentials field is deprecated - now read from environment variables
    // keeping it optional for backward compatibility if it still exists in some records
    credentials: z
      .preprocess(
        (value) => (typeof value === 'object' && value !== null ? value : {}),
        PaymentGatewayCredentialsSchema,
      )
      .optional(),
  })
  .transform((record) => ({
    ...record,
    // Provide empty credentials object if not present
    credentials: record.credentials || {},
    status: (record.is_active ? 'active' : 'inactive') as PaymentGatewayStatus,
  }));

export type PaymentGatewayRecord = z.infer<typeof PaymentGatewayRecordSchema>;

const maskSecret = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= 4) {
    return '••••';
  }
  return `••••${trimmed.slice(-4)}`;
};

export const mapRecordToSettings = (record: PaymentGatewayRecord): PaymentGatewaySettings => {
  const credentials = (record.credentials || {}) as PaymentGatewayCredentials;
  const mode = record.mode || normalizeMode(credentials.mode);

  return {
    provider: record.provider,
    status: record.status,
    functionality: record.functionality || 'payment',
    mode,
    // Availability settings
    availableOnAffiliateCheckout: record.available_on_affiliate_checkout ?? true,
    availableOnMlmCheckout: record.available_on_mlm_checkout ?? true,
    availableOnMainStore: record.available_on_main_store ?? true,
    // Credentials are deprecated - now read from environment variables
    clientId: credentials.clientId ?? null,
    publishableKey: credentials.publishableKey ?? null,
    hasSecret: Boolean(credentials.secret),
    hasWebhookSecret: Boolean(credentials.webhookSecret),
    secretPreview: maskSecret(credentials.secret),
    webhookSecretPreview: maskSecret(credentials.webhookSecret),
    connectClientId: credentials.connectClientId ?? null,
    testClientId: credentials.testClientId ?? null,
    testPublishableKey: credentials.testPublishableKey ?? null,
    hasTestSecret: Boolean(credentials.testSecret),
    hasTestWebhookSecret: Boolean(credentials.testWebhookSecret),
    testSecretPreview: maskSecret(credentials.testSecret),
    testWebhookSecretPreview: maskSecret(credentials.testWebhookSecret),
    testConnectClientId: credentials.testConnectClientId ?? null,
    updatedAt: record.updated_at ?? null,
  };
};

export const mapRecordToPublicInfo = (record: PaymentGatewayRecord): PaymentGatewayPublicInfo => {
  const credentials = (record.credentials || {}) as PaymentGatewayCredentials;
  const mode = normalizeMode(credentials.mode);

  const clientId =
    record.provider === 'paypal'
      ? mode === 'test'
        ? credentials.testClientId ?? null
        : credentials.clientId ?? null
      : null;
  const publishableKey =
    record.provider === 'stripe'
      ? mode === 'test'
        ? credentials.testPublishableKey ?? null
        : credentials.publishableKey ?? null
      : null;

  return {
    provider: record.provider,
    mode,
    functionality: record.functionality || 'payment',
    clientId,
    publishableKey,
    availableOnAffiliateCheckout: record.available_on_affiliate_checkout ?? true,
    availableOnMlmCheckout: record.available_on_mlm_checkout ?? true,
    availableOnMainStore: record.available_on_main_store ?? true,
    metadata: {
      requiresRedirect: record.provider !== 'wallet',
    },
  };
};
