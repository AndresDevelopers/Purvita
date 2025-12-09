import { NextRequest, NextResponse } from 'next/server';
import { EnvironmentConfigurationError } from '@/lib/env';
import { createProfileEarningsService } from '@/modules/profile/factories/profile-earnings-service-factory';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { createSecurityModule } from '@/modules/security/factories/security-module';

const { rateLimitService } = createSecurityModule();

export async function POST(req: NextRequest) {
  // ✅ SECURITY: Rate limiting to prevent abuse of earnings transfer
  const guard = await rateLimitService.guard(req, 'api:profile:earnings:transfer:post');
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
    const body = await req.json().catch(() => ({}));
    const amountCentsRaw = (body as { amountCents?: unknown }).amountCents;
    const amountCents = typeof amountCentsRaw === 'number' ? Math.round(amountCentsRaw) : Number.parseInt(`${amountCentsRaw ?? ''}`, 10);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const service = createProfileEarningsService();
    const result = await service.transferToWallet(userId, amountCents);

    const response = NextResponse.json(result);
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    console.error('[Transfer API] Error:', error);

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

    // ✅ SECURITY: Sanitize error message in production
    const message = process.env.NODE_ENV === 'production'
      ? 'Failed to transfer earnings'
      : (error instanceof Error ? error.message : 'Failed to transfer earnings');
    console.error('[Transfer API] Error message:', message);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
