import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';

const querySchema = z.object({
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
});

const fulfillmentRowSchema = z.object({
  order_id: z.string(),
  order_item_id: z.string().nullable(),
  order_created_at: z.string(),
  order_status: z.string(),
  order_total_cents: z.coerce.number(),
  order_tax_cents: z.coerce.number().nullable(),
  order_shipping_cents: z.coerce.number().nullable(),
  order_discount_cents: z.coerce.number().nullable(),
  purchase_source: z.enum(['main_store', 'affiliate_store']).nullable(),
  currency: z.string(),
  customer_id: z.string(),
  customer_name: z.string().nullable(),
  customer_email: z.string().nullable(),
  customer_phone: z.string().nullable(),
  address_line: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  product_id: z.string().nullable(),
  product_name: z.string().nullable(),
  quantity: z.coerce.number().nullable(),
  unit_price_cents: z.coerce.number().nullable(),
  line_total_cents: z.coerce.number().nullable(),
});

const toUtcDayRange = (date: string) => {
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid date provided.');
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

/**
 * GET /api/admin/orders/fulfillment
 * Get order fulfillment data for a specific date
 * Requires: manage_orders permission
 */
export const GET = withAdminPermission('manage_orders', async (request) => {
  try {
    const parseResult = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters.' },
        { status: 400 },
      );
    }

    const targetDate = parseResult.data.date ?? new Date().toISOString().slice(0, 10);
    const { start, end } = toUtcDayRange(targetDate);

    let adminClient: SupabaseClient | null = null;
    try {
      adminClient = await createAdminClient();
    } catch (adminClientError) {
      console.error('[admin-orders] service role client is unavailable', adminClientError);
      return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 });
    }

    if (!adminClient) {
      console.error('[admin-orders] service role client is unavailable');
      return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 });
    }

    const { data, error } = await adminClient
      .from('order_fulfillment_view')
      .select('*')
      .gte('order_created_at', start)
      .lt('order_created_at', end)
      .order('order_created_at', { ascending: false });

    if (error) {
      console.error('[admin-orders] failed to load fulfillment view', error);
      return NextResponse.json(
        { error: 'Unable to load orders for the selected day.' },
        { status: 500 },
      );
    }

    const rows = fulfillmentRowSchema.array().parse(data ?? []);

    const summary = {
      totalOrders: 0,
      totalUnits: 0,
      totalRevenueCents: 0,
      totalShippingCents: 0,
      totalTaxCents: 0,
      totalDiscountCents: 0,
    };

    const orders = new Map<
      string,
      {
        orderId: string;
        status: string;
        createdAt: string;
        currency: string;
        totalCents: number;
        taxCents: number;
        shippingCents: number;
        discountCents: number;
        purchaseSource: 'main_store' | 'affiliate_store';
        customer: {
          id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          addressLine: string | null;
          city: string | null;
          state: string | null;
          postalCode: string | null;
          country: string | null;
        };
        items: Array<{
          itemId: string;
          productId: string | null;
          productName: string | null;
          quantity: number;
          unitPriceCents: number;
          lineTotalCents: number;
        }>;
      }
    >();

    for (const row of rows) {
      let order = orders.get(row.order_id);

      if (!order) {
        summary.totalOrders += 1;
        summary.totalRevenueCents += row.order_total_cents;
        summary.totalShippingCents += row.order_shipping_cents ?? 0;
        summary.totalTaxCents += row.order_tax_cents ?? 0;
        summary.totalDiscountCents += row.order_discount_cents ?? 0;

        order = {
          orderId: row.order_id,
          status: row.order_status,
          createdAt: row.order_created_at,
          currency: row.currency,
          totalCents: row.order_total_cents,
          taxCents: row.order_tax_cents ?? 0,
          shippingCents: row.order_shipping_cents ?? 0,
          discountCents: row.order_discount_cents ?? 0,
          purchaseSource: (row.purchase_source as 'main_store' | 'affiliate_store') ?? 'main_store',
          customer: {
            id: row.customer_id,
            name: row.customer_name,
            email: row.customer_email,
            phone: row.customer_phone,
            addressLine: row.address_line,
            city: row.city,
            state: row.state,
            postalCode: row.postal_code,
            country: row.country,
          },
          items: [],
        };

        orders.set(row.order_id, order);
      }

      if (row.order_item_id) {
        const quantity = Number.isFinite(row.quantity ?? NaN) ? Math.max(0, row.quantity ?? 0) : 0;
        const unitPriceCents = Number.isFinite(row.unit_price_cents ?? NaN)
          ? Math.max(0, row.unit_price_cents ?? 0)
          : 0;
        const lineTotalCents = Number.isFinite(row.line_total_cents ?? NaN)
          ? Math.max(0, row.line_total_cents ?? 0)
          : quantity * unitPriceCents;

        summary.totalUnits += quantity;

        order.items.push({
          itemId: row.order_item_id,
          productId: row.product_id,
          productName: row.product_name,
          quantity,
          unitPriceCents,
          lineTotalCents,
        });
      }
    }

    return NextResponse.json({
      date: targetDate,
      timezone: 'UTC',
      generatedAt: new Date().toISOString(),
      summary,
      orders: Array.from(orders.values()),
    });
  } catch (error) {
    console.error('[admin-orders] unexpected fulfillment error', error);
    return NextResponse.json(
      { error: 'Unexpected error loading order fulfillment data.' },
      { status: 500 },
    );
  }
})
