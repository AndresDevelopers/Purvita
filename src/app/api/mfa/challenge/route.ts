import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMfaService } from '@/modules/mfa';
import { z } from 'zod';

const ChallengeSchema = z.object({
  factorId: z.string().uuid(),
});

const VerifyChallengeSchema = z.object({
  factorId: z.string().uuid(),
  challengeId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

/**
 * POST /api/mfa/challenge
 * 
 * Create an MFA challenge for login verification.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // For challenge creation, we need a session (even if not fully authenticated)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const validatedData = ChallengeSchema.parse(body);

    const mfaService = createMfaService(supabase);
    const result = await mfaService.createChallenge(validatedData.factorId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create challenge' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      challenge: result.challenge,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    console.error('[MFA Challenge] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mfa/challenge
 * 
 * Verify an MFA challenge during login.
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // For challenge verification, we need a session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const validatedData = VerifyChallengeSchema.parse(body);

    const mfaService = createMfaService(supabase);
    const result = await mfaService.verifyChallenge(
      validatedData.factorId,
      validatedData.challengeId,
      validatedData.code
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Verification failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      session: result.session,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    console.error('[MFA Challenge Verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
