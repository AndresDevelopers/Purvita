import { NextResponse } from 'next/server';
import { EnvironmentConfigurationError } from '@/lib/env';
import { createDashboardSummaryService } from '@/modules/multilevel/factories/dashboard-summary-service-factory';
import { DashboardSummaryService } from '@/modules/multilevel/services/dashboard-summary-service';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/with-auth';

/**
 * GET /api/dashboard/summary
 * SECURED: Uses Supabase session authentication
 */
export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;

  // First, try the service-role path (requires SUPABASE_SERVICE_ROLE_KEY)
  try {
    const summaryService = createDashboardSummaryService();
    const summary = await summaryService.getSummary(userId);
    return NextResponse.json(summary);
  } catch (error) {
    // If environment is missing service role key, fall back to user-scoped server client
    if (error instanceof EnvironmentConfigurationError) {
      try {
        const supabase = await createServerSupabaseClient();
        const service = new DashboardSummaryService(supabase);
        const summary = await service.getSummary(userId);
        return NextResponse.json(summary);
      } catch (innerError) {
        console.error('Failed to load dashboard summary (fallback)', innerError);
        return NextResponse.json({ error: 'Failed to load dashboard summary' }, { status: 500 });
      }
    }

    console.error('Failed to load dashboard summary', error);
    return NextResponse.json({ error: 'Failed to load dashboard summary' }, { status: 500 });
  }
});
