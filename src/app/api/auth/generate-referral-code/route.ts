import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateReferralCode } from '@/lib/services/user-service';
import { createSecurityModule } from '@/modules/security/factories/security-module';

const GenerateReferralCodeSchema = z.object({
  name: z.string().min(1).max(180),
});

const { rateLimitService } = createSecurityModule();

/**
 * POST /api/auth/generate-referral-code
 * 
 * Generates a unique referral code for a new user based on their name.
 * This endpoint is called during registration to ensure referral codes
 * are generated server-side with proper uniqueness validation.
 * 
 * Security features:
 * - Rate limiting by IP address
 * - Server-side uniqueness validation
 * - Input validation with Zod
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await rateLimitService.guard(req, 'api:auth:generate-referral-code:post');

    if (!guard.result.allowed) {
      const response = NextResponse.json(
        rateLimitService.buildErrorPayload(guard.locale),
        { status: 429 },
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const body = await req.json();
    const validatedData = GenerateReferralCodeSchema.parse(body);

    // Generate unique referral code using the existing service
    const referralCode = await generateReferralCode(validatedData.name);

    const response = NextResponse.json({ 
      referralCode,
      success: true,
    });

    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API] Failed to generate referral code', error);
    
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

