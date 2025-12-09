import { randomUUID } from 'crypto';
import {
  TestHistoryItemSchema,
  TestStatusSchema,
} from '../schemas/payment-test-schemas';
import type {
  TestHistoryItem,
  TestStatus,
} from '../schemas/payment-test-schemas';
import type { PaymentProvider } from '../domain/models/payment-gateway';

export interface TestHistoryRepository {
  getHistory(provider?: PaymentProvider, limit?: number): Promise<TestHistoryItem[]>;
  addItem(item: Omit<TestHistoryItem, 'id' | 'createdAt'>): Promise<TestHistoryItem>;
  updateItem(id: string, updates: Partial<TestHistoryItem>): Promise<TestHistoryItem | null>;
  clearHistory(provider?: PaymentProvider): Promise<void>;
  getStats(provider?: PaymentProvider): Promise<TestHistoryStats>;
}

export interface TestHistoryStats {
  total: number;
  byStatus: Record<TestStatus, number>;
  lastEntryAt: string | null;
}

class InMemoryTestHistoryRepository implements TestHistoryRepository {
  private items: TestHistoryItem[] = [];

  async getHistory(provider?: PaymentProvider, limit: number = 20): Promise<TestHistoryItem[]> {
    const filtered = provider
      ? this.items.filter((item) => item.provider === provider)
      : this.items;

    return filtered.slice(0, Math.max(limit, 0));
  }

  async addItem(item: Omit<TestHistoryItem, 'id' | 'createdAt'>): Promise<TestHistoryItem> {
    const newItem: TestHistoryItem = TestHistoryItemSchema.parse({
      ...item,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    });

    this.items = [newItem, ...this.items];
    return newItem;
  }

  async updateItem(id: string, updates: Partial<TestHistoryItem>): Promise<TestHistoryItem | null> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    const updated = TestHistoryItemSchema.safeParse({
      ...this.items[index],
      ...updates,
    });

    if (!updated.success) {
      throw new Error('Invalid test history update payload');
    }

    this.items[index] = updated.data;
    return this.items[index];
  }

  async clearHistory(provider?: PaymentProvider): Promise<void> {
    if (!provider) {
      this.items = [];
      return;
    }

    this.items = this.items.filter((item) => item.provider !== provider);
  }

  async getStats(provider?: PaymentProvider): Promise<TestHistoryStats> {
    const history = await this.getHistory(provider, Number.MAX_SAFE_INTEGER);
    const statuses = TestStatusSchema.options;

    const byStatus = statuses.reduce<Record<TestStatus, number>>((acc, status) => {
      acc[status] = history.filter((item) => item.status === status).length;
      return acc;
    }, {} as Record<TestStatus, number>);

    const lastEntryAt = history.length > 0 ? history[0].createdAt : null;

    return {
      total: history.length,
      byStatus,
      lastEntryAt,
    };
  }
}

export class TestHistoryRepositoryFactory {
  static create(): TestHistoryRepository {
    return new InMemoryTestHistoryRepository();
  }
}

export type { TestHistoryItem };
