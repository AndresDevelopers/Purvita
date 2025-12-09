import type { CheckoutProfile, CheckoutProfileUpdateInput } from '../models/checkout-profile';

export type CheckoutEvent =
  | { type: 'profile_loaded'; payload: CheckoutProfile | null }
  | { type: 'profile_save_started'; payload: CheckoutProfileUpdateInput }
  | { type: 'profile_saved'; payload: CheckoutProfile }
  | { type: 'profile_save_failed'; error: Error }
  | { type: 'profile_load_failed'; error: Error };

export type CheckoutObserver = (event: CheckoutEvent) => void;

export class CheckoutEventBus {
  private observers = new Set<CheckoutObserver>();

  subscribe(observer: CheckoutObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  emit(event: CheckoutEvent) {
    this.observers.forEach((observer) => observer(event));
  }

  clear() {
    this.observers.clear();
  }
}
