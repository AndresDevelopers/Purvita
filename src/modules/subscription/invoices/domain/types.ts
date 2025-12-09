import type { PaymentGateway, PaymentStatus } from '@/modules/multilevel/domain/types';

export interface SubscriptionInvoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  gateway: PaymentGateway;
  gateway_ref: string;
  period_end: string | null;
  created_at: string;
  archived: boolean;
}
