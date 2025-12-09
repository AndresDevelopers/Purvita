/**
 * Security Reports API
 *
 * Generate and retrieve security reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { generateSecurityReport } from '@/lib/security/admin-security-reports';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/security/reports
 * Get available security reports
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'daily';
    const format = searchParams.get('format') || 'json';

    const report = await generateSecurityReport(period as 'daily' | 'weekly' | 'monthly');

    if (format === 'pdf') {
      // TODO: Generate PDF report
      return NextResponse.json(
        { error: 'PDF reports not yet implemented' },
        { status: 501 }
      );
    }

    if (format === 'csv') {
      // Generate CSV
      const csv = convertReportToCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="security-report-${period}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON by default
    return NextResponse.json(report);
  } catch (error) {
    console.error('[SecurityReportsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate security report' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/security/reports
 * Schedule automatic security reports
 * Requires: manage_security permission
 */
export const POST = withAdminPermission('manage_security', async (request: NextRequest) => {
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { frequency, recipients, format } = body;

    if (!frequency || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Frequency and at least one recipient are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const adminUserId = (request as any).user?.id;

    // Deactivate any existing schedule for this frequency
    await supabase
      .from('security_report_schedules')
      .update({ is_active: false })
      .eq('frequency', frequency)
      .eq('is_active', true);

    // Create new schedule
    const { data: schedule, error } = await supabase
      .from('security_report_schedules')
      .insert({
        frequency,
        recipients,
        format: format || 'email',
        is_active: true,
        next_run_at: getNextRunDate(frequency),
        created_by: adminUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('[SecurityReportsAPI] Error saving schedule:', error);
      return NextResponse.json(
        { error: 'Failed to save schedule' },
        { status: 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Scheduled security report',
      {
        ...extractRequestMetadata(request),
        action: 'schedule_security_report',
        resourceType: 'security_report_schedule',
        scheduleId: schedule.id,
        frequency: frequency,
        recipientCount: recipients?.length || 0,
        format: format,
      },
      true
    );

    return NextResponse.json({
      success: true,
      message: 'Report schedule saved',
      schedule,
    });
  } catch (error) {
    console.error('[SecurityReportsAPI] Error scheduling report:', error);
    return NextResponse.json(
      { error: 'Failed to schedule security report' },
      { status: 500 }
    );
  }
});

/**
 * Convert report to CSV format
 */
function convertReportToCSV(report: any): string {
  const lines: string[] = [];

  // Header
  lines.push('Security Report');
  lines.push(`Period: ${report.period}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`);
  lines.push('');

  // Summary
  lines.push('Summary');
  lines.push('Metric,Value');
  Object.entries(report.summary).forEach(([key, value]) => {
    lines.push(`${key},${value}`);
  });
  lines.push('');

  // Suspicious Activities
  lines.push('Suspicious Activities');
  lines.push('Type,Severity,Count,Description');
  report.suspiciousActivities.forEach((activity: any) => {
    lines.push(`${activity.type},${activity.severity},${activity.count},"${activity.description}"`);
  });
  lines.push('');

  // Top Threats
  lines.push('Top Threats');
  lines.push('Type,Count,Last Seen');
  report.topThreats.forEach((threat: any) => {
    lines.push(`${threat.type},${threat.count},${threat.lastSeen}`);
  });

  return lines.join('\n');
}

/**
 * Get next run date based on frequency
 */
function getNextRunDate(frequency: string): string {
  const now = new Date();

  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      now.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      break;
  }

  return now.toISOString();
}
