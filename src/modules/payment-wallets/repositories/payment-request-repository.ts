import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentRequest, PaymentRequestWithWallet, PaymentRequestStatus } from '../domain/types';

export class PaymentRequestRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<PaymentRequestWithWallet | null> {
    const { data, error } = await this.client
      .from('payment_requests')
      .select(`
        *,
        wallet:payment_wallets(*),
        user:profiles(id, name, email)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PaymentRequestWithWallet | null;
  }

  async findByUserId(userId: string, limit = 50): Promise<PaymentRequestWithWallet[]> {
    const { data, error } = await this.client
      .from('payment_requests')
      .select(`
        *,
        wallet:payment_wallets(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? []) as PaymentRequestWithWallet[];
  }

  async findByStatus(status: PaymentRequestStatus, limit = 100): Promise<PaymentRequestWithWallet[]> {
    const { data, error } = await this.client
      .from('payment_requests')
      .select(`
        *,
        wallet:payment_wallets(*),
        user:profiles(id, name, email)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? []) as PaymentRequestWithWallet[];
  }

  async findAll(limit = 100): Promise<PaymentRequestWithWallet[]> {
    const { data, error } = await this.client
      .from('payment_requests')
      .select(`
        *,
        wallet:payment_wallets(*),
        user:profiles(id, name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? []) as PaymentRequestWithWallet[];
  }

  async create(request: Partial<PaymentRequest>): Promise<PaymentRequest> {
    const { data, error } = await this.client
      .from('payment_requests')
      .insert(request)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async update(id: string, updates: Partial<PaymentRequest>): Promise<PaymentRequest> {
    const { data, error } = await this.client
      .from('payment_requests')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateStatus(
    id: string,
    status: PaymentRequestStatus,
    processedBy: string,
    adminNotes?: string
  ): Promise<PaymentRequest> {
    const updates: Partial<PaymentRequest> = {
      status,
      processed_by: processedBy,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (adminNotes) {
      updates.admin_notes = adminNotes;
    }

    const { data, error } = await this.client
      .from('payment_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}
