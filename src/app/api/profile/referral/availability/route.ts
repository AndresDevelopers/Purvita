import { NextResponse } from 'next/server';
import { createProfileSummaryService } from '@/modules/profile/factories/profile-summary-service-factory';
import { withAuth } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

export const POST = withAuth<unknown>(async (req) => {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(req);
  if (csrfError) return csrfError;

  const userId = req.user.id;

  let payload: unknown;

  try {
    payload = await req.json();
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const body = (payload as { referral_code?: string | null } | null) ?? null;
  const referralCode = body?.referral_code ?? null;

  const service = createProfileSummaryService();

  try {
    const result = await service.checkReferralAvailability(userId, referralCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to verify referral code availability', error);
    return NextResponse.json({ error: 'Failed to verify referral code availability' }, { status: 500 });
  }
});
