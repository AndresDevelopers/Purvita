import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsModuleFactory } from '@/modules/analytics/factories/analytics-module';
import { PrivacyConsentSchema } from '@/modules/analytics/domain/models/analytics-config';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/analytics/consent
 * Update privacy consent for analytics tracking
 */
export const POST = withAuth<any>(async (request) => {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate request body
    const parsed = PrivacyConsentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid consent data', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const analyticsService = AnalyticsModuleFactory.createAnalyticsService(supabase);

    // Update consent
    const config = await analyticsService.updatePrivacyConsent(request.user.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: config,
      message: 'Privacy consent updated successfully',
    });
  } catch (error) {
    console.error('[Analytics Consent API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update consent', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
