import type { SupabaseClient } from '@supabase/supabase-js';

export interface OrderItemRecord {
  product_id: string | null;
  qty: number;
  price_cents: number;
  product?: { id: string; name: string | null } | null;
}

export interface OrderRecord {
  id: string;
  user_id: string;
  status: string;
  total_cents: number;
  created_at: string;
  items?: OrderItemRecord[];
  archived?: boolean;
}

export class OrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByUser(userId: string, limit = 20): Promise<OrderRecord[]> {
    const { data, error } = await this.client
      .from('orders')
      .select(
        `id,
         user_id,
         status,
         total_cents,
         created_at,
         archived,
         items:order_items(
           product_id,
           qty,
           price_cents,
           product:products(id, name)
         )`
      )
      .eq('user_id', userId)
      .eq('purchase_source', 'main_store')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? (data as any[]) : [];

    return rows.map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      status: row.status as string,
      total_cents: Number(row.total_cents ?? 0),
      created_at: row.created_at as string,
      archived: Boolean(row.archived ?? false),
      items: Array.isArray(row.items)
        ? (row.items as any[]).map((item) => ({
            product_id: (item.product_id as string | null) ?? null,
            qty: Number(item.qty ?? 0),
            price_cents: Number(item.price_cents ?? 0),
            product: Array.isArray(item.product)
              ? (item.product[0] as { id: string; name: string | null } | undefined) ?? null
              : (item.product as { id: string; name: string | null } | null) ?? null,
          }))
        : [],
    }));
  }

  async sumOrderRevenue() {
    const { data, error } = await this.client
      .from('orders')
      .select('total_cents')
      .eq('status', 'paid');

    if (error) {
      throw error;
    }

    const total = (data ?? []).reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
    return total;
  }
}
