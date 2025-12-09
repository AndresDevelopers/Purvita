import { NextResponse } from 'next/server';
import { getAllPlans, createPlan } from '@/lib/services/plan-service';
import { PlanSchema } from '@/lib/models/definitions';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * GET /api/admin/plans
 * Get all subscription plans
 * Requires: manage_plans permission
 */
export const GET = withAdminPermission('manage_plans', async () => {
  try {
    const plans = await getAllPlans();
    return NextResponse.json(plans);
  } catch (error) {
    console.error('API error in GET /api/admin/plans:', error);

    // Provide more specific error messages based on error type
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
        errorMessage = 'Supabase URL not configured';
        statusCode = 500;
      } else if (error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        errorMessage = 'Supabase service role key not configured';
        statusCode = 500;
      } else if (error.message.includes('Database connection failed')) {
        errorMessage = 'Database connection failed. Please check your Supabase configuration.';
        statusCode = 503;
      } else if (error.message.includes('Error fetching plans')) {
        errorMessage = 'Failed to retrieve plans from database';
        statusCode = 503;
      } else {
        errorMessage = error.message;
        statusCode = 500;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        path: '/api/admin/plans'
      },
      { status: statusCode }
    );
  }
});

/**
 * POST /api/admin/plans
 * Create a new subscription plan
 * Requires: manage_plans permission
 */
export const POST = withAdminPermission('manage_plans', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    let body;
    try {
      body = await request.json();
    } catch (_parseError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          timestamp: new Date().toISOString(),
          path: '/api/admin/plans'
        },
        { status: 400 }
      );
    }

    // Validate the input
    const planData = PlanSchema.omit({ id: true, created_at: true, updated_at: true }).parse(body);

    const newPlan = await createPlan(planData);

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin created new subscription plan: ${newPlan.name}`,
      {
        ...extractRequestMetadata(request),
        action: 'create_plan',
        resourceType: 'plan',
        resourceId: newPlan.id,
        planName: newPlan.name,
        planPrice: newPlan.price,
        planSlug: newPlan.slug,
      },
      true
    );

    return NextResponse.json(newPlan, { status: 201 });
  } catch (error) {
    console.error('API error in POST /api/admin/plans:', error);

    // Provide more specific error messages based on error type
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
        errorMessage = 'Supabase URL not configured';
        statusCode = 500;
      } else if (error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        errorMessage = 'Supabase service role key not configured';
        statusCode = 500;
      } else if (error.message.includes('Database connection failed')) {
        errorMessage = 'Database connection failed. Please check your Supabase configuration.';
        statusCode = 503;
      } else if (error.message.includes('Error creating plan')) {
        errorMessage = 'Failed to create plan in database';
        statusCode = 503;
      } else if (error.message.includes('Missing multilingual plan columns')) {
        errorMessage = error.message; // This is already a specific error message
        statusCode = 500;
      } else {
        errorMessage = error.message;
        statusCode = 400;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        path: '/api/admin/plans'
      },
      { status: statusCode }
    );
  }
});