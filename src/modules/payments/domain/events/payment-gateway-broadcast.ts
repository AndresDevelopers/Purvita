import type { PaymentGatewaySettings } from '../models/payment-gateway';

/**
 * Cross-tab communication for payment gateway updates using BroadcastChannel API.
 * This allows different browser tabs/windows to receive real-time updates when
 * payment gateway settings are changed.
 */

type BroadcastMessage = {
  type: 'settings_updated';
  payload: PaymentGatewaySettings;
};

type BroadcastListener = (message: BroadcastMessage) => void;

class PaymentGatewayBroadcast {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<BroadcastListener>();
  private readonly channelName = 'payment-gateway-updates';

  constructor() {
    // Only initialize BroadcastChannel in browser environment
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        this.notifyListeners(event.data);
      };
    }
  }

  /**
   * Broadcast a settings update to all other tabs
   */
  broadcast(message: BroadcastMessage): void {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  /**
   * Subscribe to settings updates from other tabs
   */
  subscribe(listener: BroadcastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all local listeners
   */
  private notifyListeners(message: BroadcastMessage): void {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error('[PaymentGatewayBroadcast] Listener error:', error);
      }
    });
  }

  /**
   * Close the broadcast channel
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}

// Singleton instance
let broadcastInstance: PaymentGatewayBroadcast | null = null;

export const getPaymentGatewayBroadcast = (): PaymentGatewayBroadcast => {
  if (!broadcastInstance) {
    broadcastInstance = new PaymentGatewayBroadcast();
  }
  return broadcastInstance;
};

/**
 * Reset the broadcast instance (useful for testing)
 */
export const resetPaymentGatewayBroadcast = (): void => {
  if (broadcastInstance) {
    broadcastInstance.close();
    broadcastInstance = null;
  }
};

