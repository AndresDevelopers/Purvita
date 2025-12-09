import type { AdminDashboardData } from '../entities/admin-dashboard';

export type AdminDashboardEvent =
  | { type: 'loading' }
  | { type: 'loaded'; payload: AdminDashboardData }
  | { type: 'error'; error: Error };

export type AdminDashboardObserver = (event: AdminDashboardEvent) => void;

export class AdminDashboardEventBus {
  private observers = new Set<AdminDashboardObserver>();

  subscribe(observer: AdminDashboardObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  emit(event: AdminDashboardEvent) {
    this.observers.forEach((observer) => {
      observer(event);
    });
  }

  clear() {
    this.observers.clear();
  }
}
