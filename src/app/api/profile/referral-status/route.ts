import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createSecurityModule } from '@/modules/security/factories/security-module';

/**
 * GET /api/profile/referral-status
 *
 * Secure endpoint to check if the current authenticated user was referred by a specific affiliate.
 * Returns ONLY the referral status, not the entire profile.
 *
 * Security features:
 * - Rate limiting
 * - Authentication required
 * - Minimal data exposure (only boolean result)
 * - No sensitive profile data leaked
 *
 * Query parameters:
 * - affiliateId: The sponsor ID to check against
 */

const querySchema = z.object({
  affiliateId: z.string().uuid('Invalid affiliate ID format'),
});

const { rateLimitService } = createSecurityModule();

export async function GET(req: NextRequest) {
  const guard = await rateLimitService.guard(req, 'api:profile:referral-status:get');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), { status: 429 });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const response = NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to check referral status',
        },
        { status: 401 }
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }

    // Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const affiliateId = searchParams.get('affiliateId');

    let validatedQuery: z.infer<typeof querySchema>;
    try {
      validatedQuery = querySchema.parse({ affiliateId });
    } catch (error) {
      const response = NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: error instanceof z.ZodError ? (error.issues[0]?.message ?? 'Invalid affiliateId') : 'Invalid affiliateId',
        },
        { status: 400 }
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }

    // Check if user was referred by the specified affiliate
    // Only query the referred_by field, nothing else
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[API] Error checking referral status:', profileError);
      const response = NextResponse.json(
        {
          error: 'Internal error',
          message: 'Failed to check referral status',
        },
        { status: 500 }
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }

    // Return ONLY the boolean result - no other data
    const response = NextResponse.json({
      isReferredBy: profile?.referred_by === validatedQuery.affiliateId,
    });

    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    console.error('[API] Unexpected error in referral-status:', error);
    const response = NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
    return rateLimitService.applyHeaders(response, guard.result);
  }
}
