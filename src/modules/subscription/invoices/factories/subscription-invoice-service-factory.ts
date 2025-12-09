import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentRepository } from '@/modules/multilevel/repositories/payment-repository';
import { SubscriptionInvoiceService } from '../services/subscription-invoice-service';

export const createSubscriptionInvoiceModule = (client: SupabaseClient) => {
  const payments = new PaymentRepository(client);
  const service = new SubscriptionInvoiceService(payments);

  return { service };
};
