import { NextRequest, NextResponse } from 'next/server';
import { createProfileEarningsService } from '@/modules/profile/factories/profile-earnings-service-factory';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { createSecurityModule } from '@/modules/security/factories/security-module';

const { rateLimitService } = createSecurityModule();

export async function DELETE(req: NextRequest) {
  // ✅ SECURITY: Rate limiting to prevent abuse of payout account operations
  const guard = await rateLimitService.guard(req, 'api:profile:earnings:payout-account:delete');
  if (!guard.result.allowed) {
    const response = NextResponse.json(
      rateLimitService.buildErrorPayload(guard.locale),
      { status: 429 }
    );
    return rateLimitService.applyHeaders(response, guard.result);
  }

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
    const service = createProfileEarningsService();
    const result = await service.disconnectPayoutAccount(userId);

    const response = NextResponse.json(result, { status: 200 });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    // ✅ SECURITY: Sanitize error message in production
    const message = process.env.NODE_ENV === 'production'
      ? 'Failed to disconnect payout account'
      : (error instanceof Error ? error.message : 'Failed to disconnect payout account');

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
