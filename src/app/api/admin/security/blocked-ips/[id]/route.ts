import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * DELETE /api/admin/security/blocked-ips/[id]
 * Unblock an IP address
 * Requires: manage_security permission
 */
export const DELETE = withAdminPermission('manage_security', async (request, context: { params: Promise<{ id: string }> }) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('blocked_ips')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error unblocking IP:', error);
      return NextResponse.json(
        { error: 'Failed to unblock IP address' },
        { status: 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Unblocked IP address',
      {
        ...extractRequestMetadata(request),
        action: 'unblock_ip',
        resourceType: 'blocked_ip',
        blockedIpId: id,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/security/blocked-ips/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

