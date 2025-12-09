export type AdminBroadcastEvent =
  | { type: 'overview_loading' }
  | { type: 'overview_loaded'; totalSegments: number }
  | { type: 'overview_failed'; error: Error }
  | { type: 'preview_loading' }
  | { type: 'preview_ready'; recipients: number }
  | { type: 'preview_failed'; error: Error }
  | { type: 'broadcast_sending'; audience: string }
  | { type: 'broadcast_sent'; delivered: number }
  | { type: 'broadcast_failed'; error: Error };

export type AdminBroadcastObserver = (event: AdminBroadcastEvent) => void;

export class AdminBroadcastEventBus {
  private observers = new Set<AdminBroadcastObserver>();

  subscribe(observer: AdminBroadcastObserver) {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  emit(event: AdminBroadcastEvent) {
    this.observers.forEach((observer) => observer(event));
  }
}

