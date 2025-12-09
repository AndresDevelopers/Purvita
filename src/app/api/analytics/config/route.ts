import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsModuleFactory } from '@/modules/analytics/factories/analytics-module';
import { AnalyticsConfigUpdateSchema } from '@/modules/analytics/domain/models/analytics-config';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * GET /api/analytics/config
 * Get analytics configuration for the authenticated user
 */
export const GET = withAuth<any>(async (request) => {
  try {
    const supabase = await createClient();
    const analyticsService = AnalyticsModuleFactory.createAnalyticsService(supabase);

    // Get or create config
    const config = await analyticsService.getOrCreateConfig(request.user.id);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('[Analytics Config API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/analytics/config
 * Update analytics configuration for the authenticated user
 */
export const PUT = withAuth<any>(async (request) => {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate request body
    const parsed = AnalyticsConfigUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid config data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const analyticsService = AnalyticsModuleFactory.createAnalyticsService(supabase);

    // Update config
    const config = await analyticsService.updateConfig(request.user.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('[Analytics Config API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update config', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
