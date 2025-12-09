import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';

/**
 * GET /api/admin/orders/available-dates
 * Returns an array of dates (YYYY-MM-DD) that have at least one order
 * Requires: manage_orders permission
 */
export const GET = withAdminPermission('manage_orders', async () => {
  try {
    let adminClient;
    try {
      adminClient = await createAdminClient();
    } catch (adminClientError) {
      console.error('[admin-orders-dates] service role client is unavailable', adminClientError);
      return NextResponse.json({ error: 'Unable to load order dates.' }, { status: 500 });
    }

    if (!adminClient) {
      console.error('[admin-orders-dates] service role client is unavailable');
      return NextResponse.json({ error: 'Unable to load order dates.' }, { status: 500 });
    }

    // Query distinct dates from orders table where status is 'paid'
    const { data, error } = await adminClient
      .from('orders')
      .select('created_at')
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin-orders-dates] failed to fetch order dates', error);
      return NextResponse.json({ error: 'Unable to load order dates.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ dates: [] });
    }

    // Extract unique dates in YYYY-MM-DD format
    const uniqueDates = new Set<string>();
    for (const row of data) {
      if (row.created_at) {
        const date = new Date(row.created_at).toISOString().slice(0, 10);
        uniqueDates.add(date);
      }
    }

    const dates = Array.from(uniqueDates).sort((a, b) => b.localeCompare(a));

    return NextResponse.json({ dates });
  } catch (error) {
    console.error('[admin-orders-dates] unexpected error', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
})

