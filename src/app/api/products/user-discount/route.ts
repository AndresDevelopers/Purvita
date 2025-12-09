import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPhaseGroupGainRate } from '@/lib/helpers/settings-helper';

/**
 * GET /api/products/user-discount
 * 
 * Returns the sponsor group gain rate for the authenticated user based on their phase.
 * This value represents how much their sponsor earns from each product sale they generate.
 * 
 * Response:
 * {
 *   userPhase: number,
 *   gainRate: number (0-1),
 *   gainPercentage: number (0-100)
 * }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's current phase
    const { data: phaseData, error: phaseError } = await supabase
      .from('phases')
      .select('phase')
      .eq('user_id', user.id)
      .maybeSingle();

    if (phaseError) {
      console.error('[GroupGain] Error fetching user phase:', phaseError);
      return NextResponse.json({
        userPhase: 0,
        gainRate: 0,
        gainPercentage: 0,
      });
    }

    const userPhase = phaseData?.phase ?? 0;

    // Get the configured group gain rate for this phase
    const gainRate = await getPhaseGroupGainRate(userPhase);
    const gainPercentage = Math.round(gainRate * 100);

    return NextResponse.json({
      userPhase,
      gainRate,
      gainPercentage,
    });
  } catch (error) {
    console.error('[GroupGain] Unexpected error:', error);
    return NextResponse.json({
      userPhase: 0,
      gainRate: 0,
      gainPercentage: 0,
    });
  }
}

