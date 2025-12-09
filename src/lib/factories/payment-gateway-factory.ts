import { createClient } from '@supabase/supabase-js';
import { SupabasePaymentGatewayRepository } from '@/modules/payments/data/repositories/supabase-payment-gateway-repository';
import type { PaymentGatewayRepository } from '@/modules/payments/domain/contracts/payment-gateway-repository';
import { logUserAction } from '@/lib/services/audit-log-service';
import {
  detectMissingSupabaseEnv,
  formatMissingSupabaseEnvMessage,
  type SupabaseEnvKey,
} from '@/lib/utils/supabase-env';

const missingEnv = (message: string) => new Error(message);

/**
 * Creates a payment gateway repository with proper Supabase client configuration
 * @returns Configured SupabasePaymentGatewayRepository instance
 * @throws Error if required environment variables are missing
 */
const createMissingEnvRepository = (missingKeys: SupabaseEnvKey[]): PaymentGatewayRepository => {
  const missingMessage = formatMissingSupabaseEnvMessage(missingKeys);
  const errorFactory = () => missingEnv(missingMessage);

  return {
    async listSettings() {
      console.warn(`[PaymentGatewayRepository] ${missingMessage}`);
      return [];
    },
    async updateSettings() {
      throw errorFactory();
    },
    async listActiveGateways() {
      console.warn(`[PaymentGatewayRepository] ${missingMessage}`);
      return [];
    },
  };
};

export const PAYMENT_GATEWAY_REQUIRED_ENV: SupabaseEnvKey[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

export const createPaymentGatewayRepository = (): PaymentGatewayRepository => {
  const missingKeys = detectMissingSupabaseEnv(PAYMENT_GATEWAY_REQUIRED_ENV);

  if (missingKeys.length > 0) {
    return createMissingEnvRepository(missingKeys);
  }

  const resolvedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const resolvedServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const resolvedAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const adminClient = createClient(resolvedUrl, resolvedServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const componentClient = createClient(resolvedUrl, resolvedAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return new SupabasePaymentGatewayRepository({
    adminClient,
    componentClient,
    auditLogger: logUserAction,
  });
};