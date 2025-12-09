import { TestHistoryRepositoryFactory } from '../repositories/test-history-repository';
import type { PaymentProvider } from '../domain/models/payment-gateway';
import type { TestHistoryItem } from '../repositories/test-history-repository';

export class TestHistoryService {
  private static repository = TestHistoryRepositoryFactory.create();

  static async getHistory(provider?: PaymentProvider, limit = 20): Promise<{ history: TestHistoryItem[] }> {
    const history = await this.repository.getHistory(provider, limit);
    return { history };
  }

  static async addHistoryItem(item: Omit<TestHistoryItem, 'id' | 'createdAt'>): Promise<TestHistoryItem> {
    return this.repository.addItem(item);
  }

  static async updateHistoryItem(id: string, updates: Partial<TestHistoryItem>): Promise<TestHistoryItem | null> {
    return this.repository.updateItem(id, updates);
  }

  static async clearHistory(provider?: PaymentProvider): Promise<void> {
    return this.repository.clearHistory(provider);
  }

  static async getHistoryStats(provider?: PaymentProvider) {
    return this.repository.getStats(provider);
  }

  // New method for adding test results with proper typing
  static async addTestResult(params: {
    testId: string;
    provider: any;
    scenario: string;
    amount: number;
    currency: string;
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    description: string;
    paymentUrl?: string;
    orderId?: string;
    sessionId?: string;
    error?: string;
    createdAt?: string;
    completedAt?: string;
    debugInfo?: Record<string, any>;
  }): Promise<TestHistoryItem> {
    return this.addHistoryItem({
      provider: params.provider,
      scenario: params.scenario,
      amount: params.amount,
      currency: params.currency,
      status: params.status,
      description: params.description,
      paymentUrl: params.paymentUrl,
      orderId: params.orderId,
      sessionId: params.sessionId,
      error: params.error,
      completedAt: params.completedAt,
      debugInfo: params.debugInfo,
    });
  }
}