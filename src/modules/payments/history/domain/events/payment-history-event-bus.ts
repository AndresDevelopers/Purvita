import type { PaymentHistoryEntry } from '../models/payment-history-entry';
import type { PaymentScheduleConfig } from '../models/payment-schedule';

export type PaymentHistoryEvent =
  | { type: 'history_loaded'; entries: PaymentHistoryEntry[] }
  | { type: 'history_error'; error: Error }
  | { type: 'entry_updated'; entry: PaymentHistoryEntry }
  | { type: 'entry_added'; entry: PaymentHistoryEntry }
  | { type: 'schedule_updated'; schedule: PaymentScheduleConfig };

export type PaymentHistoryObserver = (event: PaymentHistoryEvent) => void;

export class PaymentHistoryEventBus {
  private observers = new Set<PaymentHistoryObserver>();

  subscribe(observer: PaymentHistoryObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  emit(event: PaymentHistoryEvent) {
    for (const observer of this.observers) {
      observer(event);
    }
  }
}
