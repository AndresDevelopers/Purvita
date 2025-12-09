import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const UnarchiveOrdersSchema = z.object({
  orderIds: z.array(z.string()).min(1, 'At least one order ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { orderIds } = UnarchiveOrdersSchema.parse(body);

    // Verify that all orders belong to the authenticated user
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id')
      .in('id', orderIds);

    if (ordersError) {
      console.error('[unarchive-orders] Failed to fetch orders:', ordersError);
      return NextResponse.json({ error: 'Failed to verify orders' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No orders found' }, { status: 404 });
    }

    // Check if all orders belong to the user
    const unauthorizedOrders = orders.filter(order => order.user_id !== user.id);
    if (unauthorizedOrders.length > 0) {
      return NextResponse.json({ error: 'Access denied to some orders' }, { status: 403 });
    }

    // Unarchive the orders
    const { error: updateError } = await supabase
      .from('orders')
      .update({ archived: false })
      .in('id', orderIds);

    if (updateError) {
      console.error('[unarchive-orders] Failed to unarchive orders:', updateError);
      return NextResponse.json({ error: 'Failed to unarchive orders' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully unarchived ${orderIds.length} order${orderIds.length > 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error('[unarchive-orders] Unexpected error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}