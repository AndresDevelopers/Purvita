import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const UpdateStatusSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'cleared', 'confirmed_fraud']),
});

/**
 * PATCH /api/admin/security/fraud-alerts/[id]
 * Update fraud alert status
 * Requires: manage_security permission
 */
export const PATCH = withAdminPermission('manage_security', async (request, context: { params: Promise<{ id: string }> }) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status } = UpdateStatusSchema.parse(body);

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('wallet_fraud_alerts')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error updating fraud alert:', error);
      return NextResponse.json(
        { error: 'Failed to update fraud alert' },
        { status: 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated fraud alert status',
      {
        ...extractRequestMetadata(request),
        action: 'update_fraud_alert',
        resourceType: 'fraud_alert',
        fraudAlertId: id,
        newStatus: status,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error in PATCH /api/admin/security/fraud-alerts/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

