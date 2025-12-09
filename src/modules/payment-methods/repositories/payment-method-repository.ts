import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentMethod, CreatePaymentMethodInput } from '../domain/types';

export class PaymentMethodRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<PaymentMethod[]> {
    const { data, error } = await this.client
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    const { data, error } = await this.client
      .from('payment_methods')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findDefaultByUserId(userId: string): Promise<PaymentMethod | null> {
    const { data, error } = await this.client
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findByStripeId(stripePaymentMethodId: string): Promise<PaymentMethod | null> {
    const { data, error } = await this.client
      .from('payment_methods')
      .select('*')
      .eq('stripe_payment_method_id', stripePaymentMethodId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async create(userId: string, input: CreatePaymentMethodInput): Promise<PaymentMethod> {
    const { data, error } = await this.client
      .from('payment_methods')
      .insert({
        user_id: userId,
        ...input,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async setDefault(id: string, userId: string): Promise<PaymentMethod> {
    const { data, error } = await this.client
      .from('payment_methods')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('payment_methods')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }
}
