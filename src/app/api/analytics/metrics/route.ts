import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsModuleFactory } from '@/modules/analytics/factories/analytics-module';
import { MetricsQuerySchema } from '@/modules/analytics/domain/models/analytics-metrics';

/**
 * GET /api/analytics/metrics
 * Get analytics metrics for the authenticated user
 * Query params: period, start_date, end_date, include_advanced
 */
export const GET = withAuth<any>(async (request) => {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const query = {
      period: searchParams.get('period') || 'last_30_days',
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
      include_advanced: searchParams.get('include_advanced') === 'true',
    };

    // Validate query
    const parsed = MetricsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const metricsService = AnalyticsModuleFactory.createMetricsService(supabase);

    // Get metrics
    const metrics = await metricsService.getMetrics(request.user.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[Analytics Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
