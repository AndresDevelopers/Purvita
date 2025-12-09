import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { WarehouseOrderSummarySchema } from '@/modules/orders/warehouse/domain/order-lookup';
import {
  createAdminClientOrThrow,
  ensureAdmin,
} from '../../warehouse/entries/admin-warehouse-utils';

const querySchema = z.object({
  term: z.string().trim().min(1).optional(),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().min(1).max(50))
    .optional(),
});

const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const deriveOrderCode = (row: { id: string; metadata?: unknown }): string => {
  if (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {
    const raw = (row.metadata as Record<string, unknown>).order_code;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }

  return row.id;
};

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[warehouse-orders] Search request received');

    const params = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    console.log('[warehouse-orders] Search params:', params);

    await ensureAdmin();

    console.log('[warehouse-orders] Admin verified');

    let adminClient: SupabaseClient;

    try {
      adminClient = createAdminClientOrThrow();
      console.log('[warehouse-orders] Admin client created successfully');
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error('[warehouse-orders] unable to create admin client', error);
      return NextResponse.json({ error: 'Unable to search orders.' }, { status: 500 });
    }

    const limit = params.limit ?? 10;

    let query = adminClient
      .from('orders')
      .select(
        `id,
         status,
         total_cents,
         created_at,
         metadata,
         user_id`
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (params.term && params.term.length > 0) {
      const normalized = `%${params.term}%`;
      query = query.or(`id.ilike.${normalized},metadata->>order_code.ilike.${normalized}`);
      console.log('[warehouse-orders] Searching with term:', params.term);
    }

    console.log('[warehouse-orders] Executing query...');
    const { data, error } = await query;

    if (error) {
      console.error('[warehouse-orders] failed to search orders', error);
      return NextResponse.json({ error: 'Unable to search orders.' }, { status: 500 });
    }

    console.log('[warehouse-orders] Query successful, found', data?.length ?? 0, 'orders');

    const rows = Array.isArray(data) ? data : [];

    // Fetch customer info separately for each order
    const ordersWithCustomers = await Promise.all(
      rows.map(async (row) => {
        let customerName: string | null = null;
        let customerEmail: string | null = null;

        if (row.user_id) {
          const { data: profile } = await adminClient
            .from('profiles')
            .select('name, email')
            .eq('id', row.user_id)
            .single();

          if (profile) {
            customerName = sanitizeString(profile.name);
            customerEmail = sanitizeString(profile.email);
          }
        }

        const orderCode = deriveOrderCode({ id: String(row.id), metadata: row.metadata });

        return WarehouseOrderSummarySchema.parse({
          id: String(row.id),
          code: orderCode,
          status: sanitizeString(row.status) ?? 'pending',
          totalCents: Number(row.total_cents ?? 0),
          createdAt: new Date(row.created_at as string).toISOString(),
          customerName,
          customerEmail,
        });
      })
    );

    console.log('[warehouse-orders] Returning', ordersWithCustomers.length, 'orders');

    return NextResponse.json({ orders: ordersWithCustomers });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('[warehouse-orders] unexpected search error', error);
    return NextResponse.json({ error: 'Unexpected error searching orders.' }, { status: 500 });
  }
}
