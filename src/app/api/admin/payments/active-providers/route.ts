import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';

/**
 * GET /api/admin/payments/active-providers
 * Returns list of active payment providers configured by admin
 * Requires: manage_payments permission
 */
export const GET = withAdminPermission('manage_payments', async () => {
  try {
    const supabase = await createClient();

    // Get active payment providers
    const { data: providers, error: providersError } = await supabase
      .from('payment_gateway_settings')
      .select('provider, status, mode')
      .eq('status', 'active');

    if (providersError) {
      console.error('[active-providers] Failed to fetch providers:', providersError);
      return NextResponse.json({ error: 'Failed to fetch payment providers' }, { status: 500 });
    }

    return NextResponse.json(
      {
        providers: providers || [],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[active-providers] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
})

