/**
 * Security Dashboard API
 *
 * Provides real-time security metrics and data
 */

import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { getRecentSuspiciousActivities } from '@/lib/security/admin-activity-monitor';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/security/dashboard
 * Get security dashboard data
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    const supabase = getAdminClient();

    // Get suspicious activities from last 24 hours
    const suspiciousActivities = await getRecentSuspiciousActivities(24 * 60);

    // Get recent security events
    const { data: securityEvents } = await supabase
      .from('security_audit_logs')
      .select('*')
      .in('event_type', [
        'RATE_LIMIT_EXCEEDED',
        'ACCESS_DENIED',
        'CSRF_TOKEN_VALIDATION_FAILED',
        'FRAUD_DETECTED',
        'THREAT_DETECTED',
        'SUSPICIOUS_ACTIVITY_DETECTED',
      ])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Get blocked IPs
    const { data: blockedIPs } = await supabase
      .from('blocked_ips')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get IP whitelist status
    const { data: whitelistSettings } = await supabase
      .from('admin_ip_whitelist_settings')
      .select('enabled')
      .eq('id', 'global')
      .single();

    const { data: whitelistEntries } = await supabase
      .from('admin_ip_whitelist')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false });

    // Get fraud alerts
    const { data: fraudAlerts } = await supabase
      .from('fraud_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate statistics
    const stats = {
      suspiciousActivitiesCount: suspiciousActivities.length,
      blockedIPsCount: blockedIPs?.length || 0,
      activeWhitelistCount: whitelistEntries?.length || 0,
      whitelistEnabled: whitelistSettings?.enabled || false,
      activeFraudAlertsCount: fraudAlerts?.length || 0,
      securityEventsLast24h: securityEvents?.length || 0,
      criticalEvents: securityEvents?.filter(e => e.severity === 'critical').length || 0,
    };

    return NextResponse.json({
      stats,
      suspiciousActivities: suspiciousActivities.slice(0, 10),
      securityEvents: securityEvents?.slice(0, 20) || [],
      blockedIPs: blockedIPs?.slice(0, 10) || [],
      whitelistEntries: whitelistEntries?.slice(0, 10) || [],
      fraudAlerts: fraudAlerts?.slice(0, 5) || [],
    });
  } catch (error) {
    console.error('[SecurityDashboardAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load security dashboard data' },
      { status: 500 }
    );
  }
});
