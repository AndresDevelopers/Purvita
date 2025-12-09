import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/security/fraud-alerts
 * Get all fraud alerts
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Fraud Alerts] Service role key not configured, returning empty array');
      return NextResponse.json([]);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('wallet_fraud_alerts')
      .select(`
        *,
        profiles:user_id (
          email,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching fraud alerts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fraud alerts' },
        { status: 500 }
      );
    }

    // Transform data to include user info
    const transformedData = (data || []).map((item: any) => ({
      ...item,
      user_email: item.profiles?.email,
      user_name: item.profiles?.name,
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in GET /api/admin/security/fraud-alerts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

