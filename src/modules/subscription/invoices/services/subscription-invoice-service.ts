import type { PaymentRepository } from '@/modules/multilevel/repositories/payment-repository';
import type { SubscriptionInvoice } from '../domain/types';

interface ListInvoiceOptions {
  limit?: number;
  includeArchived?: boolean;
}

export class SubscriptionInvoiceService {
  constructor(private readonly payments: PaymentRepository) {}

  async listInvoices(userId: string, options: ListInvoiceOptions = {}): Promise<SubscriptionInvoice[]> {
    const records = await this.payments.listByUser(userId, {
      limit: options.limit,
      includeArchived: options.includeArchived ?? true,
      kind: 'subscription',
    });

    return records.map((record) => ({
      id: record.id,
      amount_cents: record.amount_cents,
      currency: record.currency ?? 'USD',
      status: record.status,
      gateway: record.gateway,
      gateway_ref: record.gateway_ref,
      period_end: record.period_end,
      created_at: record.created_at,
      archived: Boolean(record.archived),
    }));
  }

  async archiveInvoices(userId: string, invoiceIds: string[]) {
    await this.payments.updateArchiveStatus(userId, invoiceIds, true);
  }

  async unarchiveInvoices(userId: string, invoiceIds: string[]) {
    await this.payments.updateArchiveStatus(userId, invoiceIds, false);
  }

  async getInvoice(userId: string, invoiceId: string) {
    return this.payments.findByIdForUser(userId, invoiceId);
  }
}
