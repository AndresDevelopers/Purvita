import { NextResponse } from 'next/server';
import { EnvironmentConfigurationError } from '@/lib/env';
import { createProfileSummaryService } from '@/modules/profile/factories/profile-summary-service-factory';
import { ReferralCodeError } from '@/modules/profile/services/profile-summary-service';
import { withAuth } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * GET /api/profile/summary
 * SECURED: Uses Supabase session authentication
 */
export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;

  console.log('[API Profile Summary] Request received for userId:', userId);

  try {
    console.log('[API Profile Summary] Creating service...');
    const service = createProfileSummaryService();

    console.log('[API Profile Summary] Fetching summary...');
    const payload = await service.getSummary(userId);

    console.log('[API Profile Summary] Summary fetched successfully');
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      console.error('[API Profile Summary] Missing environment configuration', error);
      return NextResponse.json(
        {
          error: 'environment-configuration-missing',
          message: error.message,
          missing: error.missingKeys,
        },
        { status: 503 },
      );
    }

    console.error('[API Profile Summary] Failed to load profile summary:', error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error('[API Profile Summary] Error name:', error.name);
      console.error('[API Profile Summary] Error message:', error.message);
      console.error('[API Profile Summary] Error stack:', error.stack);
    }

    // Check if it's a database table missing error
    const errorMessage = error instanceof Error ? error.message : 'Failed to load profile summary';
    const isTableMissing = errorMessage.includes('relation') && errorMessage.includes('does not exist');

    if (isTableMissing) {
      console.error('[API Profile Summary] Database table missing. Please run the full-schema.sql migration.');
      return NextResponse.json({
        error: 'Database tables not initialized',
        details: 'Required tables (network_commissions, payout_accounts) are missing. Please run database migrations.',
        hint: 'Execute docs/database/full-schema.sql in your Supabase SQL editor'
      }, { status: 503 });
    }

    return NextResponse.json({
      error: 'Failed to load profile summary',
      details: errorMessage
    }, { status: 500 });
  }
});

/**
 * PATCH /api/profile/summary
 * SECURED: Uses Supabase session authentication
 */
export const PATCH = withAuth<unknown>(async (req) => {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(req);
  if (csrfError) return csrfError;

  const userId = req.user.id;

  try {
    const service = createProfileSummaryService();
    const payload = await req.json();
    const profile = await service.updateProfile(userId, payload);
    const summary = await service.getSummary(userId);
    return NextResponse.json({ profile, membership: summary.membership });
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      console.error('Missing environment configuration while updating profile', error);
      return NextResponse.json(
        {
          error: 'environment-configuration-missing',
          message: error.message,
          missing: error.missingKeys,
        },
        { status: 503 },
      );
    }
    console.error('Failed to update profile', error);

    if (error instanceof ReferralCodeError) {
      const status = error.reason === 'conflict' ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
