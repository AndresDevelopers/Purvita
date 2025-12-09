import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { createReferralModule } from '@/modules/referrals/factories/referral-module';
import { ReferralResolutionError } from '@/modules/referrals/services/referral-service';

const bodySchema = z.object({
  input: z.string().min(1, 'Referral input is required'),
});

const { rateLimitService } = createSecurityModule();

export async function POST(req: NextRequest) {
  const guard = await rateLimitService.guard(req, 'api:referrals:resolve:post');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), { status: 429 });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  let body: z.infer<typeof bodySchema>;

  try {
    const json = await req.json();
    body = bodySchema.parse(json);
  } catch (error) {
    console.warn('[api.referrals.resolve] Invalid request body', error);
    const response = NextResponse.json({ error: 'Invalid referral payload' }, { status: 400 });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  const { service } = createReferralModule();

  try {
    const result = await service.resolveSponsor(body.input);

    // ✅ SECURITY FIX #5: Do NOT expose email address
    // Only return public information (name and ID)
    const response = NextResponse.json({
      sponsorId: result.sponsorId,
      normalizedCode: result.normalizedCode,
      referralCode: result.referralCode,
      sponsor: {
        name: result.sponsorName,
        // ❌ REMOVED: email (information disclosure vulnerability)
      },
    });

    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof ReferralResolutionError) {
      const status = error.code === 'not_found' ? 404 : 400;
      const response = NextResponse.json({ error: error.message, code: error.code }, { status });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    console.error('[api.referrals.resolve] Unexpected error resolving referral', error);
    const response = NextResponse.json({ error: 'Failed to resolve referral code' }, { status: 500 });
    return rateLimitService.applyHeaders(response, guard.result);
  }
}
