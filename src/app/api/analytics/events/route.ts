import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsModuleFactory } from '@/modules/analytics/factories/analytics-module';
import { AnalyticsEventInputSchema } from '@/modules/analytics/domain/models/analytics-event';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/analytics/events
 * Track analytics events
 */
export const POST = withAuth<any>(
  async (request) => {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) return csrfError;

    try {
      const supabase = await createClient();
      const body = await request.json();

      // Validate request body
      const eventSchema = z.union([
        AnalyticsEventInputSchema,
        z.array(AnalyticsEventInputSchema),
      ]);

      const parsed = eventSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid event data', details: parsed.error.errors },
          { status: 400 }
        );
      }

      const analyticsService = AnalyticsModuleFactory.createAnalyticsService(supabase);

      // Handle single or batch events
      let result;
      if (Array.isArray(parsed.data)) {
        result = await analyticsService.trackEventsBatch(parsed.data);
      } else {
        result = await analyticsService.trackEvent(parsed.data);
      }

      return NextResponse.json(
        {
          success: true,
          data: result,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Analytics Events API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to track event', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  },
  { required: false } // Allow tracking for guests
);

/**
 * GET /api/analytics/events?session_id={sessionId}
 * Get events for a session
 */
export const GET = withAuth<any>(async (request) => {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const analyticsService = AnalyticsModuleFactory.createAnalyticsService(supabase);

    let events;
    if (sessionId) {
      events = await analyticsService.getSessionEvents(sessionId);
    } else if (startDate && endDate) {
      events = await analyticsService.getUserEvents(
        request.user.id,
        new Date(startDate),
        new Date(endDate)
      );
    } else {
      return NextResponse.json(
        { error: 'session_id or start_date and end_date are required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('[Analytics Events API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
