import type { SubscriptionRecord, SubscriptionStatus } from '../domain/types';

export type SubscriptionCancellationReason = 'user' | 'payment_failure';

export interface SubscriptionPaymentRecordedPayload {
  userId: string;
  planId?: string | null;
  amountCents: number;
  gatewayRef: string;
  periodEnd: string | null;
  gateway: 'stripe' | 'paypal' | 'wallet';
}

export interface SubscriptionCanceledPayload {
  userId: string;
  subscription: SubscriptionRecord | null;
  previousStatus: SubscriptionStatus | null;
  reason: SubscriptionCancellationReason;
  locale?: string | null;
}

export interface SubscriptionUpdatedPayload {
  subscription: SubscriptionRecord | null;
}

export interface SubscriptionEventPayloads {
  'subscription.updated': SubscriptionUpdatedPayload;
  'payment.recorded': SubscriptionPaymentRecordedPayload;
  'subscription.canceled': SubscriptionCanceledPayload;
}

export type SubscriptionEventType = keyof SubscriptionEventPayloads;

export type SubscriptionEvent<T extends SubscriptionEventType = SubscriptionEventType> = {
  type: T;
  payload: SubscriptionEventPayloads[T];
};

type SubscriptionObserver<T extends SubscriptionEventType> = (
  event: SubscriptionEvent<T>,
) => void | Promise<void>;

export class SubscriptionEventBus {
  private observers: Map<SubscriptionEventType, Set<SubscriptionObserver<any>>> = new Map();

  subscribe<T extends SubscriptionEventType>(type: T, observer: SubscriptionObserver<T>) {
    if (!this.observers.has(type)) {
      this.observers.set(type, new Set());
    }
    this.observers.get(type)!.add(observer as SubscriptionObserver<any>);
  }

  unsubscribe<T extends SubscriptionEventType>(type: T, observer: SubscriptionObserver<T>) {
    this.observers.get(type)?.delete(observer as SubscriptionObserver<any>);
  }

  notify<T extends SubscriptionEventType>(event: SubscriptionEvent<T>) {
    const observers = this.observers.get(event.type);
    if (!observers) {
      return;
    }
    observers.forEach((observer) => {
      try {
        const result = observer(event as SubscriptionEvent<any>);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error('Subscription observer execution failed', err);
          });
        }
      } catch (err) {
        console.error('Subscription observer execution failed', err);
      }
    });
  }
}

export const createSubscriptionEventBus = () => new SubscriptionEventBus();
