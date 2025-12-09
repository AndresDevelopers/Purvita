import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentGatewayRepository } from '../../domain/contracts/payment-gateway-repository';
import {
  mapRecordToPublicInfo,
  mapRecordToSettings,
  PaymentGatewayRecordSchema,
  PaymentGatewaySettingsSchema,
  type PaymentGatewayCredentials,
  type PaymentGatewayMode,
  type PaymentGatewayRecord,
  type PaymentGatewaySettings,
  type PaymentGatewayUpdateInput,
} from '../../domain/models/payment-gateway';

export interface SupabasePaymentGatewayRepositoryDependencies {
  adminClient: SupabaseClient | null;
  componentClient: SupabaseClient;
  auditLogger: (action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) => Promise<void>;
}

const TABLE_NAME = 'payment_gateways';

const ensureAdminClient = (client: SupabaseClient | null) => {
  if (!client) {
    throw new Error('Admin Supabase client is required to manage payment gateways.');
  }
  return client;
};

const sanitizeSecret = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
};

const resolveSecretField = (
  incoming: string | null | undefined,
  current: string | null | undefined,
) => {
  if (incoming === undefined) {
    return current ?? null;
  }
  return sanitizeSecret(incoming);
};

const resolveMode = (
  incoming: PaymentGatewayMode | null | undefined,
  current: PaymentGatewayMode | null | undefined,
): PaymentGatewayMode => {
  const normalized = incoming ?? current;
  return normalized === 'test' ? 'test' : 'production';
};

const mergeCredentials = (
  existing: PaymentGatewayRecord | null,
  update: PaymentGatewayUpdateInput,
) => {
  const currentCredentials = existing?.credentials ?? ({} as PaymentGatewayCredentials);
  return {
    clientId:
      (update as any).clientId !== undefined ? (update as any).clientId : (currentCredentials as any).clientId ?? null,
    publishableKey:
      update.publishableKey !== undefined
        ? update.publishableKey
        : (currentCredentials as any).publishableKey ?? null,
    secret: resolveSecretField((update as any).secret, (currentCredentials as any).secret ?? null),
    webhookSecret: resolveSecretField((update as any).webhookSecret, (currentCredentials as any).webhookSecret ?? null),
    connectClientId:
      update.connectClientId !== undefined
        ? update.connectClientId
        : (currentCredentials as any).connectClientId ?? null,
    testClientId:
      update.testClientId !== undefined
        ? update.testClientId
        : (currentCredentials as any).testClientId ?? null,
    testPublishableKey:
      update.testPublishableKey !== undefined
        ? update.testPublishableKey
        : (currentCredentials as any).testPublishableKey ?? null,
    testSecret: resolveSecretField((update as any).testSecret, (currentCredentials as any).testSecret ?? null),
    testWebhookSecret: resolveSecretField(
      update.testWebhookSecret,
      (currentCredentials as any).testWebhookSecret ?? null,
    ),
    testConnectClientId:
      update.testConnectClientId !== undefined
        ? update.testConnectClientId
        : (currentCredentials as any).testConnectClientId ?? null,
    mode: resolveMode((update as any).mode ?? null, (currentCredentials as any).mode ?? null),
  };
};

export class SupabasePaymentGatewayRepository implements PaymentGatewayRepository {
  constructor(private readonly deps: SupabasePaymentGatewayRepositoryDependencies) {}

  private async fetchRecord(provider: string): Promise<PaymentGatewayRecord | null> {
    const adminClient = ensureAdminClient(this.deps.adminClient);
    const { data, error } = await adminClient
      .from(TABLE_NAME)
      .select('*')
      .eq('provider', provider)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error fetching payment gateway: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return PaymentGatewayRecordSchema.parse(data);
  }

  async listSettings(): Promise<PaymentGatewaySettings[]> {
    const adminClient = ensureAdminClient(this.deps.adminClient);
    const { data, error } = await adminClient.from(TABLE_NAME).select('*').order('provider');

    if (error) {
      throw new Error(`Error loading payment gateways: ${error.message}`);
    }

    const records = (data ?? []).map((row) => PaymentGatewayRecordSchema.parse(row));
    return records.map((record) => mapRecordToSettings(record));
  }

  async listActiveGateways() {
    const { data, error } = await this.deps.componentClient
      .from(TABLE_NAME)
      .select('*')
      .eq('is_active', true)
      .order('provider');

    if (error) {
      throw new Error(`Error loading active payment gateways: ${error.message}`);
    }

    const records = (data ?? []).map((row) => PaymentGatewayRecordSchema.parse(row));

    // Return all active gateways - credentials are validated when used, not when listed
    // This allows payout-settings to show providers configured in /admin/pays
    return records.map((record) => mapRecordToPublicInfo(record));
  }

  async updateSettings(input: PaymentGatewayUpdateInput) {
    const adminClient = ensureAdminClient(this.deps.adminClient);
    const existingRecord = await this.fetchRecord(input.provider);

    const isActive = input.status === 'active';

    // Credentials are now read from environment variables
    // Only store is_active, functionality, mode, and availability settings in the database
    const upsertPayload = {
      provider: input.provider,
      is_active: isActive,
      functionality: input.functionality ?? existingRecord?.functionality ?? 'payment',
      mode: input.mode ?? existingRecord?.mode ?? 'production',
      // Availability settings
      available_on_affiliate_checkout: input.availableOnAffiliateCheckout ?? existingRecord?.available_on_affiliate_checkout ?? true,
      available_on_mlm_checkout: input.availableOnMlmCheckout ?? existingRecord?.available_on_mlm_checkout ?? true,
      available_on_main_store: input.availableOnMainStore ?? existingRecord?.available_on_main_store ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await adminClient
      .from(TABLE_NAME)
      .upsert(upsertPayload, { onConflict: 'provider' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Error updating payment gateway: ${error.message}`);
    }

    const record = PaymentGatewayRecordSchema.parse(data);
    const settings = mapRecordToSettings(record);

    await this.deps.auditLogger('PAYMENT_GATEWAY_UPDATED', 'payment_gateway', record.provider, {
      status: settings.status,
      functionality: record.functionality,
      mode: record.mode,
      availableOnAffiliateCheckout: record.available_on_affiliate_checkout,
      availableOnMlmCheckout: record.available_on_mlm_checkout,
      availableOnMainStore: record.available_on_main_store,
    });

    return PaymentGatewaySettingsSchema.parse(settings);
  }
}

export const __TESTING__ = {
  mergeCredentials,
  sanitizeSecret,
  resolveMode,
};
