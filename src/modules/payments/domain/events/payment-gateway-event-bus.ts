import type { PaymentGatewayPublicInfo, PaymentGatewaySettings } from '../models/payment-gateway';
import { getPaymentGatewayBroadcast } from './payment-gateway-broadcast';

type PaymentGatewayEvent =
  | { type: 'settings_loaded'; payload: PaymentGatewaySettings[] }
  | { type: 'settings_updated'; payload: PaymentGatewaySettings }
  | { type: 'providers_loaded'; payload: PaymentGatewayPublicInfo[] }
  | { type: 'settings_update_failed'; error: Error }
  | { type: 'providers_load_failed'; error: Error };

export type PaymentGatewayObserver = (event: PaymentGatewayEvent) => void;

export class PaymentGatewayEventBus {
  private observers = new Set<PaymentGatewayObserver>();

  subscribe(observer: PaymentGatewayObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  emit(event: PaymentGatewayEvent) {
    this.observers.forEach((observer) => observer(event));

    // Broadcast settings_updated events to other tabs
    if (event.type === 'settings_updated') {
      const broadcast = getPaymentGatewayBroadcast();
      broadcast.broadcast({
        type: 'settings_updated',
        payload: event.payload,
      });
    }
  }

  clear() {
    this.observers.clear();
  }
}
