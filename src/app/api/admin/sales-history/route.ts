import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/admin-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SalesRecord {
  id: string;
  type: 'order' | 'subscription';
  userId: string;
  userName: string;
  userEmail: string;
  amountCents: number;
  currency: string;
  source: 'main_store' | 'affiliate_store';
  gateway: string;
  status: string;
  createdAt: string;
  metadata?: unknown;
}

export async function GET() {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth();
    if (!authResult.authorized) {
      return authResult.response;
    }

    const supabase = await createClient();
    const salesRecords: SalesRecord[] = [];

    // Fetch paid orders (only 'paid' status to match dashboard metrics)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_cents,
        currency,
        purchase_source,
        gateway,
        status,
        created_at,
        metadata,
        profiles!user_id (
          name,
          email
        )
      `)
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
    } else if (orders) {
      for (const order of orders) {
        const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
        salesRecords.push({
          id: order.id,
          type: 'order',
          userId: order.user_id,
          userName: profile?.name || 'Unknown',
          userEmail: profile?.email || 'unknown@example.com',
          amountCents: order.total_cents || 0,
          currency: order.currency || 'USD',
          source: order.purchase_source || 'main_store',
          gateway: order.gateway || 'unknown',
          status: order.status,
          createdAt: order.created_at,
          metadata: order.metadata,
        });
      }
    }

    // Fetch paid subscriptions (from payments table)
    const { data: subscriptionPayments, error: subscriptionsError } = await supabase
      .from('payments')
      .select(`
        id,
        user_id,
        amount_cents,
        currency,
        gateway,
        status,
        created_at,
        metadata,
        profiles!user_id (
          name,
          email
        )
      `)
      .eq('kind', 'subscription')
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (subscriptionsError) {
      console.error('Error fetching subscription payments:', subscriptionsError);
    } else if (subscriptionPayments) {
      for (const payment of subscriptionPayments) {
        const profile = Array.isArray(payment.profiles) ? payment.profiles[0] : payment.profiles;
        // Try to determine source from metadata
        const source = payment.metadata?.source || 'main_store';
        
        salesRecords.push({
          id: payment.id,
          type: 'subscription',
          userId: payment.user_id,
          userName: profile?.name || 'Unknown',
          userEmail: profile?.email || 'unknown@example.com',
          amountCents: payment.amount_cents || 0,
          currency: payment.currency || 'USD',
          source: source,
          gateway: payment.gateway || 'unknown',
          status: payment.status,
          createdAt: payment.created_at,
          metadata: payment.metadata,
        });
      }
    }

    // Sort all records by date (most recent first)
    salesRecords.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json(salesRecords);
  } catch (error) {
    console.error('Error in sales-history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

