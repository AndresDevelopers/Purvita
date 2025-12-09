import { NextResponse } from 'next/server';
import { getPlanById, updatePlan, deletePlan } from '@/lib/services/plan-service';
import { PlanSchema } from '@/lib/models/definitions';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * GET /api/admin/plans/[id]
 * Get a single plan by ID
 * Requires: manage_plans permission
 */
export const GET = withAdminPermission('manage_plans', async (
  request,
  context
) => {
  try {
    const params = await (context?.params as Promise<{ id: string }>);
    const { id } = params;
    const plan = await getPlanById(id);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(plan);
  } catch (_error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('API error:', _error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/plans/[id]
 * Update a plan
 * Requires: manage_plans permission
 */
export const PUT = withAdminPermission('manage_plans', async (
  request,
  context
) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const params = await (context?.params as Promise<{ id: string }>);
    const { id } = params;
    const body = await request.json();

    // Validate the input (partial update)
    const planData = PlanSchema.omit({ id: true, created_at: true, updated_at: true }).partial().parse(body);

    const updatedPlan = await updatePlan(id, planData);

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin updated subscription plan: ${updatedPlan.name}`,
      {
        ...extractRequestMetadata(request),
        action: 'update_plan',
        resourceType: 'plan',
        resourceId: id,
        planName: updatedPlan.name,
        changedFields: Object.keys(planData),
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

/**
 * DELETE /api/admin/plans/[id]
 * Delete a plan
 * Requires: manage_plans permission
 */
export const DELETE = withAdminPermission('manage_plans', async (
  request,
  context
) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const params = await (context?.params as Promise<{ id: string }>);
    const { id} = params;

    // Get plan info before deleting for audit log
    const plan = await getPlanById(id);
    const planName = plan?.name || 'Unknown';

    await deletePlan(id);

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin deleted subscription plan: ${planName}`,
      {
        ...extractRequestMetadata(request),
        action: 'delete_plan',
        resourceType: 'plan',
        resourceId: id,
        planName,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('API error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});