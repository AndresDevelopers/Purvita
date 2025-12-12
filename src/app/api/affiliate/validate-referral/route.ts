import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/affiliate/validate-referral
 *
 * Validates that a referralCode belongs to the specified affiliateId.
 * This prevents commission theft by ensuring metadata integrity.
 *
 * Security:
 * - Validates UUID format
 * - Case-insensitive comparison
 * - Database-backed verification
 */

const ValidateReferralSchema = z.object({
  referralCode: z.string().min(1).max(50),
  affiliateId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode, affiliateId } = ValidateReferralSchema.parse(body);

    const supabase = await createClient();

    // Validate that the referralCode belongs to the affiliateId
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, referral_code')
      .eq('id', affiliateId)
      .ilike('referral_code', referralCode)
      .single();

    if (error || !profile) {
      console.warn('[Validate Referral] Invalid referral code or affiliate ID', {
        affiliateId,
        referralCode,
      });

      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid referral code or affiliate ID',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('[Validate Referral] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        valid: false,
        error: 'Validation failed',
      },
      { status: 500 }
    );
  }
}
