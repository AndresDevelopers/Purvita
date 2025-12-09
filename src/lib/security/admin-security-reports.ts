/**
 * Admin Security Reports
 *
 * Generates comprehensive security reports for admin monitoring
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { getRecentSuspiciousActivities } from './admin-activity-monitor';
import { sendSecurityAlert } from './admin-alert-system';
import { SecurityEventSeverity } from './audit-logger';

export interface SecurityReport {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  generatedAt: string;

  summary: {
    totalEvents: number;
    criticalEvents: number;
    suspiciousActivities: number;
    blockedIPs: number;
    failedLogins: number;
    rateLimitViolations: number;
    fraudAlerts: number;
  };

  suspiciousActivities: Array<{
    type: string;
    severity: string;
    count: number;
    description: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;

  topThreats: Array<{
    type: string;
    count: number;
    lastSeen: string;
    affectedUsers: number;
  }>;

  blockedIPs: Array<{
    ip: string;
    reason: string;
    blockedAt: string;
    expiresAt: string | null;
  }>;

  recommendations: string[];
}

/**
 * Generate security report for a given period
 */
export async function generateSecurityReport(
  period: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<SecurityReport> {
  const endDate = new Date();
  const startDate = getStartDate(period);

  const supabase = getAdminClient();

  // Get security events
  const { data: events } = await supabase
    .from('security_audit_log')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Get suspicious activities
  const minutesSincePeriodStart = Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60)
  );
  const suspiciousActivities = await getRecentSuspiciousActivities(minutesSincePeriodStart);

  // Get blocked IPs
  const { data: blockedIPs } = await supabase
    .from('blocked_ips')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Get fraud alerts
  const { data: fraudAlerts } = await supabase
    .from('fraud_alerts')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Calculate summary
  const summary = {
    totalEvents: events?.length || 0,
    criticalEvents: events?.filter(e => e.severity === 'critical').length || 0,
    suspiciousActivities: suspiciousActivities.length,
    blockedIPs: blockedIPs?.length || 0,
    failedLogins: events?.filter(e => e.event_type === 'LOGIN_FAILED').length || 0,
    rateLimitViolations: events?.filter(e => e.event_type === 'RATE_LIMIT_EXCEEDED').length || 0,
    fraudAlerts: fraudAlerts?.length || 0,
  };

  // Group suspicious activities by type
  const activityGroups = new Map<string, any[]>();
  suspiciousActivities.forEach(activity => {
    const existing = activityGroups.get(activity.type) || [];
    existing.push(activity);
    activityGroups.set(activity.type, existing);
  });

  const suspiciousActivitiesSummary = Array.from(activityGroups.entries()).map(
    ([type, activities]) => ({
      type,
      severity: getMostSevereSeverity(activities),
      count: activities.length,
      description: activities[0]?.description || 'No description',
      trend: calculateTrend(type, activities.length, period),
    })
  );

  // Get top threats
  const threatGroups = new Map<string, any[]>();
  (events || []).forEach(event => {
    if (isThreatEvent(event.event_type)) {
      const existing = threatGroups.get(event.event_type) || [];
      existing.push(event);
      threatGroups.set(event.event_type, existing);
    }
  });

  const topThreats = Array.from(threatGroups.entries())
    .map(([type, threats]) => ({
      type,
      count: threats.length,
      lastSeen: threats[threats.length - 1]?.created_at || '',
      affectedUsers: new Set(threats.map(t => t.user_id).filter(Boolean)).size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Format blocked IPs
  const blockedIPsList = (blockedIPs || []).map(ip => ({
    ip: ip.ip_address,
    reason: ip.reason || 'Unknown',
    blockedAt: ip.created_at,
    expiresAt: ip.expires_at,
  }));

  // Generate recommendations
  const recommendations = generateRecommendations(summary, suspiciousActivitiesSummary, topThreats);

  const report: SecurityReport = {
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    generatedAt: new Date().toISOString(),
    summary,
    suspiciousActivities: suspiciousActivitiesSummary,
    topThreats,
    blockedIPs: blockedIPsList,
    recommendations,
  };

  return report;
}

/**
 * Send security report via email
 */
export async function sendSecurityReportEmail(
  report: SecurityReport,
  recipients: string[]
): Promise<void> {
  const subject = `Security Report - ${report.period} - ${new Date(report.endDate).toLocaleDateString()}`;

  const body = formatReportForEmail(report);

  // TODO: Implement email sending
  console.log('[SecurityReports] Would send email to:', recipients);
  console.log('[SecurityReports] Subject:', subject);
  console.log('[SecurityReports] Body preview:', body.substring(0, 200));

  // For now, log as alert
  await sendSecurityAlert(
    subject,
    `Security report generated for ${report.period} period`,
    SecurityEventSeverity.INFO,
    {
      report: report.summary,
      recipients,
    }
  );
}

/**
 * Schedule automatic security reports
 */
export async function scheduleSecurityReport(
  frequency: 'daily' | 'weekly' | 'monthly',
  recipients: string[],
  format: 'email' | 'pdf' | 'csv' = 'email'
): Promise<void> {
  // TODO: Implement with cron job or scheduled task
  console.log('[SecurityReports] Scheduling report:', { frequency, recipients, format });
}

/**
 * Get start date based on period
 */
function getStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();

  switch (period) {
    case 'daily':
      now.setDate(now.getDate() - 1);
      now.setHours(0, 0, 0, 0);
      return now;

    case 'weekly':
      now.setDate(now.getDate() - 7);
      now.setHours(0, 0, 0, 0);
      return now;

    case 'monthly':
      now.setMonth(now.getMonth() - 1);
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      return now;
  }
}

/**
 * Get the most severe severity from a list of activities
 */
function getMostSevereSeverity(activities: any[]): string {
  const severities = ['low', 'medium', 'high', 'critical'];
  let maxSeverity = 'low';

  activities.forEach(activity => {
    const currentIndex = severities.indexOf(activity.severity);
    const maxIndex = severities.indexOf(maxSeverity);
    if (currentIndex > maxIndex) {
      maxSeverity = activity.severity;
    }
  });

  return maxSeverity;
}

/**
 * Calculate trend for activity type
 */
function calculateTrend(
  _type: string,
  _currentCount: number,
  _period: string
): 'increasing' | 'decreasing' | 'stable' {
  // TODO: Compare with previous period from database
  // For now, return stable
  return 'stable';
}

/**
 * Check if event type is a threat
 */
function isThreatEvent(eventType: string): boolean {
  const threatEvents = [
    'RATE_LIMIT_EXCEEDED',
    'ACCESS_DENIED',
    'CSRF_TOKEN_VALIDATION_FAILED',
    'FRAUD_DETECTED',
    'XSS_ATTEMPT_DETECTED',
    'MALICIOUS_IP_BLOCKED',
    'THREAT_DETECTED',
    'SUSPICIOUS_ACTIVITY_DETECTED',
  ];

  return threatEvents.includes(eventType);
}

/**
 * Generate recommendations based on report data
 */
function generateRecommendations(
  summary: SecurityReport['summary'],
  suspiciousActivities: SecurityReport['suspiciousActivities'],
  _topThreats: SecurityReport['topThreats']
): string[] {
  const recommendations: string[] = [];

  // Check for high critical events
  if (summary.criticalEvents > 5) {
    recommendations.push(
      `⚠️ High number of critical events (${summary.criticalEvents}). Review and address immediately.`
    );
  }

  // Check for suspicious activities
  if (summary.suspiciousActivities > 10) {
    recommendations.push(
      `🔍 ${summary.suspiciousActivities} suspicious activities detected. Investigate patterns and sources.`
    );
  }

  // Check for failed logins
  if (summary.failedLogins > 20) {
    recommendations.push(
      `🔐 High number of failed logins (${summary.failedLogins}). Consider implementing CAPTCHA or stronger rate limiting.`
    );
  }

  // Check for rate limit violations
  if (summary.rateLimitViolations > 50) {
    recommendations.push(
      `🚦 Excessive rate limit violations (${summary.rateLimitViolations}). Review rate limits or investigate potential DDoS.`
    );
  }

  // Check for fraud alerts
  if (summary.fraudAlerts > 0) {
    recommendations.push(
      `💳 Fraud alerts detected (${summary.fraudAlerts}). Review payment transactions and user activities.`
    );
  }

  // Check for rapid request patterns
  const rapidRequestActivities = suspiciousActivities.filter(a => a.type === 'rapid_requests');
  if (rapidRequestActivities.length > 0) {
    recommendations.push(
      `⚡ Rapid request patterns detected. Consider lowering rate limits or blocking suspicious IPs.`
    );
  }

  // Check for unusual time access
  const unusualTimeActivities = suspiciousActivities.filter(a => a.type === 'unusual_time');
  if (unusualTimeActivities.length > 5) {
    recommendations.push(
      `🌙 Multiple unusual time accesses detected. Review admin access patterns.`
    );
  }

  // Check for new IPs
  const newIPActivities = suspiciousActivities.filter(a => a.type === 'new_ip');
  if (newIPActivities.length > 3) {
    recommendations.push(
      `🌍 Multiple new IP addresses detected. Consider enabling IP whitelisting.`
    );
  }

  // Default recommendation if all is well
  if (recommendations.length === 0) {
    recommendations.push(
      `✅ No major security concerns detected. Continue monitoring.`
    );
  }

  return recommendations;
}

/**
 * Format report for email
 */
function formatReportForEmail(report: SecurityReport): string {
  const lines: string[] = [];

  lines.push(`Security Report - ${report.period.toUpperCase()}`);
  lines.push(`Period: ${new Date(report.startDate).toLocaleDateString()} - ${new Date(report.endDate).toLocaleDateString()}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');

  // Summary
  lines.push('📊 SUMMARY');
  lines.push('');
  lines.push(`Total Events: ${report.summary.totalEvents}`);
  lines.push(`Critical Events: ${report.summary.criticalEvents}`);
  lines.push(`Suspicious Activities: ${report.summary.suspiciousActivities}`);
  lines.push(`Blocked IPs: ${report.summary.blockedIPs}`);
  lines.push(`Failed Logins: ${report.summary.failedLogins}`);
  lines.push(`Rate Limit Violations: ${report.summary.rateLimitViolations}`);
  lines.push(`Fraud Alerts: ${report.summary.fraudAlerts}`);
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');

  // Suspicious Activities
  if (report.suspiciousActivities.length > 0) {
    lines.push('🔍 SUSPICIOUS ACTIVITIES');
    lines.push('');
    report.suspiciousActivities.forEach(activity => {
      const emoji = activity.severity === 'critical' ? '🚨' :
                    activity.severity === 'high' ? '🔴' :
                    activity.severity === 'medium' ? '⚠️' : 'ℹ️';
      lines.push(`${emoji} ${activity.type} (${activity.count}x) - ${activity.severity.toUpperCase()}`);
      lines.push(`   ${activity.description}`);
      lines.push(`   Trend: ${activity.trend}`);
      lines.push('');
    });
    lines.push('='.repeat(60));
    lines.push('');
  }

  // Top Threats
  if (report.topThreats.length > 0) {
    lines.push('⚠️ TOP THREATS');
    lines.push('');
    report.topThreats.slice(0, 5).forEach((threat, index) => {
      lines.push(`${index + 1}. ${threat.type} (${threat.count} occurrences)`);
      lines.push(`   Last seen: ${new Date(threat.lastSeen).toLocaleString()}`);
      lines.push(`   Affected users: ${threat.affectedUsers}`);
      lines.push('');
    });
    lines.push('='.repeat(60));
    lines.push('');
  }

  // Recommendations
  lines.push('💡 RECOMMENDATIONS');
  lines.push('');
  report.recommendations.forEach(rec => {
    lines.push(`• ${rec}`);
  });
  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}
