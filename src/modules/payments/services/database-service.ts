import { createClient } from '@supabase/supabase-js';
import type { PaymentProvider, PaymentGatewayCredentials } from '../domain/models/payment-gateway';

export interface PaymentGatewayConfig {
  credentials: PaymentGatewayCredentials;
  isActive: boolean;
}

export class DatabaseService {
  private static getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Database configuration missing');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  static async getPaymentGatewayConfig(provider: PaymentProvider): Promise<PaymentGatewayConfig> {
    const supabase = this.getSupabaseClient();

    const { data: settings, error } = await supabase
      .from('payment_gateways')
      .select('credentials, is_active')
      .eq('provider', provider)
      .single();

    if (error || !settings) {
      throw new Error(`${provider} configuration not found`);
    }

    if (!settings.is_active) {
      throw new Error(`${provider} is not active`);
    }

    return {
      credentials: settings.credentials as PaymentGatewayCredentials,
      isActive: settings.is_active,
    };
  }
}