import { NextResponse } from 'next/server';
import { updatePlanOrder } from '@/lib/services/plan-service';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const ReorderSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    display_order: z.number().int().min(0),
  })),
});

/**
 * POST /api/admin/plans/reorder
 * Reorder plans
 * Requires: manage_plans permission
 */
export const POST = withAdminPermission('manage_plans', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { orders } = ReorderSchema.parse(body);

    await updatePlanOrder(orders as any);

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin reordered subscription plans (${orders.length} plans affected)`,
      {
        ...extractRequestMetadata(request),
        action: 'reorder_plans',
        resourceType: 'plan',
        planCount: orders.length,
        planIds: orders.map(o => o.id),
      },
      true
    );

    return NextResponse.json({ success: true });
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

