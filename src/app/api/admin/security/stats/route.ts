import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/security/stats
 * Get security statistics for the admin dashboard
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Security Stats] Service role key not configured, returning default stats');
      return NextResponse.json({
        blockedIps: 0,
        blockedAccounts: 0,
        fraudAlerts: 0,
        securityEvents24h: 0,
      });
    }

    const supabase = createAdminClient();

    // Get blocked IPs count (active blocks only - not expired)
    // If table doesn't exist, return 0
    const { count: blockedIpsCount, error: ipsError } = await supabase
      .from('blocked_ips')
      .select('*', { count: 'exact', head: true })
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (ipsError && ipsError.code !== 'PGRST116') {
      console.error('Error fetching blocked IPs:', ipsError);
    }

    // Get blocked accounts count from user_blacklist
    // If table doesn't exist, return 0
    const { count: blockedAccountsCount, error: blacklistError } = await supabase
      .from('user_blacklist')
      .select('*', { count: 'exact', head: true });

    if (blacklistError && blacklistError.code !== 'PGRST116') {
      console.error('Error fetching blocked accounts:', blacklistError);
    }

    // Get fraud alerts count from wallet_fraud_alerts
    // If table doesn't exist, return 0
    const { count: fraudAlertsCount, error: fraudError } = await supabase
      .from('wallet_fraud_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (fraudError && fraudError.code !== 'PGRST116') {
      console.error('Error fetching fraud alerts:', fraudError);
    }

    // Get security events from last 24 hours from security_audit_logs
    // If table doesn't exist, return 0
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: securityEventsCount, error: eventsError } = await supabase
      .from('security_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    if (eventsError && eventsError.code !== 'PGRST116') {
      console.error('Error fetching security events:', eventsError);
    }

    return NextResponse.json({
      blockedIps: blockedIpsCount || 0,
      blockedAccounts: blockedAccountsCount || 0,
      fraudAlerts: fraudAlertsCount || 0,
      securityEvents24h: securityEventsCount || 0,
    });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

