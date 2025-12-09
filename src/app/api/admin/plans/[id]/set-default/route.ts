import { NextResponse } from 'next/server';
import { setDefaultPlan } from '@/lib/services/plan-service';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * POST /api/admin/plans/[id]/set-default
 * Set a plan as the default plan
 * Requires: manage_plans permission
 */
export const POST = withAdminPermission('manage_plans', async (
  request,
  context
) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const params = await (context?.params as Promise<{ id: string }>);
    const { id } = params;

    const updatedPlan = await setDefaultPlan(id);

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin set default subscription plan: ${updatedPlan.name}`,
      {
        ...extractRequestMetadata(request),
        action: 'set_default_plan',
        resourceType: 'plan',
        resourceId: id,
        planName: updatedPlan.name,
      },
      true
    );

    return NextResponse.json(updatedPlan);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('API error:', error);
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

