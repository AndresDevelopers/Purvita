/**
 * Security Report Schedule API - Individual Schedule
 *
 * Delete a specific security report schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * DELETE /api/admin/security/reports/schedules/[id]
 * Delete a security report schedule
 * Requires: manage_security permission
 */
export const DELETE = withAdminPermission('manage_security', async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid schedule ID format' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Delete the schedule
    const { error } = await supabase
      .from('security_report_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SecurityReportsAPI] Error deleting schedule:', error);
      return NextResponse.json(
        { error: 'Failed to delete schedule' },
        { status: 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.WARNING,
      'Deleted security report schedule',
      {
        ...extractRequestMetadata(request),
        action: 'delete_security_report_schedule',
        resourceType: 'security_report_schedule',
        scheduleId: id,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SecurityReportsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
});
