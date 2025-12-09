import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type {
  AdminBroadcastAudience,
  AdminBroadcastSnapshot,
  AdminBroadcastRecordInput,
  BroadcastRecipient,
} from '../../domain/models/admin-broadcast';
import type { AdminBroadcastRepository } from '../../domain/contracts/admin-broadcast-repository';

const RecipientRowSchema = z.object({
  id: z.string().uuid().nullable(),
  email: z.string().email(),
  name: z.string().nullable(),
});

type RecipientRow = {
  id: string | null;
  email: string;
  name: string | null;
};

const uniqueByEmail = (rows: RecipientRow[]): RecipientRow[] => {
  const map = new Map<string, RecipientRow>();
  for (const row of rows) {
    map.set(row.email.toLowerCase(), row);
  }
  return Array.from(map.values());
};

const sanitizeQuery = (value: string) => value.replace(/%/g, '\\%').replace(/_/g, '\\_');

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

interface SupabaseAdminBroadcastRepositoryDependencies {
  client: SupabaseClient;
}

export class SupabaseAdminBroadcastRepository implements AdminBroadcastRepository {
  constructor(private readonly deps: SupabaseAdminBroadcastRepositoryDependencies) {}

  private get client() {
    return this.deps.client;
  }

  async getSnapshot(): Promise<AdminBroadcastSnapshot> {
    const [allUsers, activeSubscribers, lapsedSubscribers, products] = await Promise.all([
      this.fetchAllUsersCount(),
      this.fetchActiveSubscribersCount(),
      this.fetchLapsedSubscribersCount(),
      this.listProducts(),
    ]);

    return {
      counts: {
        allUsers,
        activeSubscribers,
        lapsedSubscribers,
      },
      products,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRecipients(audience: AdminBroadcastAudience): Promise<BroadcastRecipient[]> {
    switch (audience.type) {
      case 'all_users':
        return this.fetchAllUsers();
      case 'active_subscribers':
        return this.fetchActiveSubscribers();
      case 'lapsed_subscribers':
        return this.fetchLapsedSubscribers();
      case 'product_purchasers':
        return this.fetchProductPurchasers(audience.productId);
      case 'specific_user':
        return this.fetchSpecificUser(audience.userId);
      default:
        return [];
    }
  }

  async saveBroadcast(
    record: AdminBroadcastRecordInput,
    result: {
      intendedCount: number;
      deliveredCount: number;
      failedCount: number;
      failures: Array<{ email: string; reason: string }>;
    },
  ): Promise<string> {
    const filter: Record<string, string> = {};

    if (record.request.type === 'product_purchasers') {
      filter.productId = record.request.productId;
    }

    if (record.request.type === 'specific_user') {
      filter.userId = record.request.userId;
    }

    const payload = {
      audience_type: record.request.type,
      audience_filter: filter,
      subject: record.request.subject,
      body: record.request.body,
      sender_id: record.senderId,
      sender_email: record.senderEmail,
      intended_count: result.intendedCount,
      delivered_count: result.deliveredCount,
      failed_count: result.failedCount,
      failure_recipients: result.failures,
    };

    const { data, error } = await this.client
      .from('admin_broadcasts')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to store broadcast metadata: ${error.message}`);
    }

    const broadcastId = (data as { id: string }).id;

    if (record.recipients.length > 0 || record.failures.length > 0) {
      const recipientPayload = [
        ...record.recipients.map((recipient) => ({
          broadcast_id: broadcastId,
          user_id: recipient.id,
          email: recipient.email,
          name: recipient.name,
          status: 'delivered',
          error_message: null,
        })),
        ...record.failures.map(({ recipient, error }) => ({
          broadcast_id: broadcastId,
          user_id: recipient.id,
          email: recipient.email,
          name: recipient.name,
          status: 'failed',
          error_message: error.message,
        })),
      ];

      const batches = chunk(recipientPayload, 100);
      for (const batch of batches) {
        const { error: insertError } = await this.client
          .from('admin_broadcast_recipients')
          .insert(batch);

        if (insertError) {
          throw new Error(`Failed to store broadcast recipients: ${insertError.message}`);
        }
      }
    }

    return broadcastId;
  }

  async listProducts(): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await this.client
      .from('products')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to load products: ${error.message}`);
    }

    const rows = Array.isArray(data) ? (data as Array<{ id: string; name: string | null }>) : [];

    return rows
      .filter((row) => row.name)
      .map((row) => ({ id: row.id, name: row.name ?? 'Unnamed product' }));
  }

  async searchUsers(query: string, limit = 12): Promise<BroadcastRecipient[]> {
    const safeQuery = sanitizeQuery(query.trim());

    if (!safeQuery) {
      return [];
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('id, email, name')
      .or(`email.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%`, { foreignTable: undefined })
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }

    const rows = RecipientRowSchema.array().parse(data ?? []) as BroadcastRecipient[];
    return rows;
  }

  private async fetchAllUsers(): Promise<BroadcastRecipient[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, email, name, status')
      .in('status', ['active', 'inactive']);

    if (error) {
      throw new Error(`Failed to load users: ${error.message}`);
    }

    const rows = Array.isArray(data)
      ? (data as Array<{ id: string; email: string; name: string | null; status: string }>)
      : [];

    const filtered = rows.filter((row) => row.email);

    return uniqueByEmail(
      filtered.map((row) => ({ id: row.id, email: row.email, name: row.name ?? null })),
    ) as BroadcastRecipient[];
  }

  private async fetchAllUsersCount(): Promise<number> {
    const { count, error } = await this.client
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'inactive']);

    if (error) {
      throw new Error(`Failed to count users: ${error.message}`);
    }

    return count ?? 0;
  }

  private async fetchActiveSubscribers(): Promise<BroadcastRecipient[]> {
    const { data, error } = await this.client
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to load active subscriptions: ${error.message}`);
    }

    const userIds = new Set(
      (Array.isArray(data) ? (data as Array<{ user_id: string | null }>) : [])
        .map((row) => row.user_id)
        .filter((value): value is string => Boolean(value)),
    );

    if (userIds.size === 0) {
      return [];
    }

    return this.fetchProfiles(Array.from(userIds));
  }

  private async fetchActiveSubscribersCount(): Promise<number> {
    const { count, error } = await this.client
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to count active subscriptions: ${error.message}`);
    }

    return count ?? 0;
  }

  private async fetchLapsedSubscribers(): Promise<BroadcastRecipient[]> {
    const ids = await this.fetchLapsedSubscriberIds();

    if (ids.length === 0) {
      return [];
    }

    return this.fetchProfiles(ids);
  }

  private async fetchLapsedSubscribersCount(): Promise<number> {
    const ids = await this.fetchLapsedSubscriberIds();
    return ids.length;
  }

  private async fetchProductPurchasers(productId: string): Promise<BroadcastRecipient[]> {
    const orderIds = await this.fetchOrderIdsForProduct(productId);

    if (orderIds.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from('orders')
      .select('user_id, status')
      .in('id', orderIds)
      .in('status', ['paid', 'refunded']);

    if (error) {
      throw new Error(`Failed to load orders for product: ${error.message}`);
    }

    const userIds = new Set(
      (Array.isArray(data) ? (data as Array<{ user_id: string | null }> ) : [])
        .map((row) => row.user_id)
        .filter((value): value is string => Boolean(value)),
    );

    if (userIds.size === 0) {
      return [];
    }

    return this.fetchProfiles(Array.from(userIds));
  }

  private async fetchSpecificUser(userId: string): Promise<BroadcastRecipient[]> {
    const profiles = await this.fetchProfiles([userId]);
    return profiles;
  }

  private async fetchOrderIdsForProduct(productId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('order_items')
      .select('order_id')
      .eq('product_id', productId);

    if (error) {
      throw new Error(`Failed to load order items for product: ${error.message}`);
    }

    const orderIds = new Set(
      (Array.isArray(data) ? (data as Array<{ order_id: string | null }>) : [])
        .map((row) => row.order_id)
        .filter((value): value is string => Boolean(value)),
    );

    return Array.from(orderIds);
  }

  private async fetchLapsedSubscriberIds(): Promise<string[]> {
    const { data: paymentRows, error: paymentError } = await this.client
      .from('payments')
      .select('user_id')
      .eq('kind', 'subscription')
      .eq('status', 'paid');

    if (paymentError) {
      throw new Error(`Failed to load subscription payments: ${paymentError.message}`);
    }

    const paidUserIds = new Set(
      (Array.isArray(paymentRows) ? (paymentRows as Array<{ user_id: string | null }>) : [])
        .map((row) => row.user_id)
        .filter((value): value is string => Boolean(value)),
    );

    if (paidUserIds.size === 0) {
      return [];
    }

    const { data: subscriptionRows, error: subscriptionError } = await this.client
      .from('subscriptions')
      .select('user_id, status')
      .in('user_id', Array.from(paidUserIds));

    if (subscriptionError) {
      throw new Error(`Failed to load subscription statuses: ${subscriptionError.message}`);
    }

    const activeUsers = new Set(
      (Array.isArray(subscriptionRows) ? (subscriptionRows as Array<{ user_id: string | null; status: string | null }>) : [])
        .filter((row) => row.status === 'active' && row.user_id)
        .map((row) => row.user_id as string),
    );

    const lapsed = Array.from(paidUserIds).filter((id) => !activeUsers.has(id));

    return lapsed;
  }

  private async fetchProfiles(userIds: string[]): Promise<BroadcastRecipient[]> {
    if (userIds.length === 0) {
      return [];
    }

    const batches = chunk(userIds, 100);
    const recipients: RecipientRow[] = [];

    for (const batch of batches) {
      const { data, error } = await this.client
        .from('profiles')
        .select('id, email, name')
        .in('id', batch);

      if (error) {
        throw new Error(`Failed to load recipient profiles: ${error.message}`);
      }

      const rows = RecipientRowSchema.array().parse(data ?? []) as BroadcastRecipient[];
      recipients.push(...rows);
    }

    return uniqueByEmail(recipients) as BroadcastRecipient[];
  }
}

