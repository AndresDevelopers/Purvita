import { NextRequest, NextResponse } from 'next/server';
import { EnvironmentConfigurationError } from '@/lib/env';
import { createProfileSummaryService } from '@/modules/profile/factories/profile-summary-service-factory';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * Initialize user profile data (wallet, phase, etc.)
 * This endpoint ensures all required data structures exist for a user
 */
export async function POST(req: NextRequest) {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  // ✅ SECURITY FIX: Use proper Supabase authentication instead of x-user-id header
  // Previous implementation used x-user-id header which could be spoofed by attackers
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id; // ✅ This userId is authenticated and cannot be spoofed

  try {
    const service = createProfileSummaryService();
    
    // Getting the summary will now auto-initialize missing data
    const summary = await service.getSummary(userId);

    return NextResponse.json({
      success: true,
      message: 'Profile data initialized successfully',
      data: {
        hasWallet: summary.wallet !== null,
        hasPhase: summary.membership.phase !== null,
        hasSubscription: summary.membership.subscription !== null,
        walletBalance: summary.wallet?.balance_cents ?? 0,
        phase: summary.membership.phase?.phase ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return NextResponse.json(
        {
          error: 'environment-configuration-missing',
          message: error.message,
          missing: error.missingKeys,
        },
        { status: 503 },
      );
    }

    console.error('[API Profile Initialize] Failed to initialize profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize profile';

    return NextResponse.json({
      error: 'Failed to initialize profile',
      details: errorMessage,
    }, { status: 500 });
  }
}
