import { ManualPaymentInputSchema, type ManualPaymentInput, type PaymentHistoryEntry, type PaymentHistoryFilter, type PaymentStatus } from '../domain/models/payment-history-entry';
import { PaymentScheduleUpdateInputSchema, type PaymentScheduleConfig, type PaymentScheduleUpdateInput } from '../domain/models/payment-schedule';
import type { PaymentHistoryEventBus } from '../domain/events/payment-history-event-bus';
import type { PaymentHistoryRepository } from '../repositories/payment-history-repository';

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown error');
};

export class PaymentHistoryService {
  constructor(
    private readonly repository: PaymentHistoryRepository,
    private readonly eventBus: PaymentHistoryEventBus,
  ) {}

  async loadHistory(filter?: PaymentHistoryFilter): Promise<PaymentHistoryEntry[]> {
    try {
      const safeFilter = filter ? { status: filter.status } : undefined;
      const entries = await this.repository.getHistory(safeFilter);
      this.eventBus.emit({ type: 'history_loaded', entries });
      return entries;
    } catch (error) {
      const normalized = toError(error);
      this.eventBus.emit({ type: 'history_error', error: normalized });
      throw normalized;
    }
  }

  async addManualPayment(input: ManualPaymentInput): Promise<PaymentHistoryEntry> {
    const payload = ManualPaymentInputSchema.parse(input);
    const entry = await this.repository.addManualPayment(payload);
    this.eventBus.emit({ type: 'entry_added', entry });
    return entry;
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<PaymentHistoryEntry> {
    const entry = await this.repository.updateStatus(id, status);
    this.eventBus.emit({ type: 'entry_updated', entry });
    return entry;
  }

  async getSchedule(): Promise<PaymentScheduleConfig> {
    return this.repository.getSchedule();
  }

  async updateSchedule(input: PaymentScheduleUpdateInput): Promise<PaymentScheduleConfig> {
    const payload = PaymentScheduleUpdateInputSchema.parse(input);
    const schedule = await this.repository.updateSchedule(payload);
    this.eventBus.emit({ type: 'schedule_updated', schedule });
    return schedule;
  }
}
