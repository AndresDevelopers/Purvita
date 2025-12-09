import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentWallet, PaymentProvider } from '../domain/types';

export class PaymentWalletRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAll(): Promise<PaymentWallet[]> {
    const { data, error } = await this.client
      .from('payment_wallets')
      .select('*')
      .order('provider');

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async findActive(): Promise<PaymentWallet[]> {
    const { data, error } = await this.client
      .from('payment_wallets')
      .select('*')
      .eq('is_active', true)
      .order('provider');

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async findById(id: string): Promise<PaymentWallet | null> {
    const { data, error } = await this.client
      .from('payment_wallets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findByProvider(provider: PaymentProvider): Promise<PaymentWallet | null> {
    const { data, error } = await this.client
      .from('payment_wallets')
      .select('*')
      .eq('provider', provider)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async create(wallet: Partial<PaymentWallet>): Promise<PaymentWallet> {
    const { data, error } = await this.client
      .from('payment_wallets')
      .insert(wallet)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async update(id: string, updates: Partial<PaymentWallet>): Promise<PaymentWallet> {
    const { data, error } = await this.client
      .from('payment_wallets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('payment_wallets')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
}
