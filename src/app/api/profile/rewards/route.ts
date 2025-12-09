import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/with-auth';

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

interface PhaseReward {
  reward_id: string;
  phase: number;
  has_free_product: boolean;
  free_product_used: boolean;
  credit_remaining_cents: number;
  credit_total_cents: number | null;
  expires_at: string | null;
}

interface PhaseRewardConfiguration {
  phase: number;
  creditCents: number;
  freeProductValueCents: number;
}

/**
 * GET /api/profile/rewards
 * SECURED: Uses Supabase session authentication
 */
export const GET = withAuth<unknown>(async (req) => {
  try {
    const userId = req.user.id;

    const supabaseAdmin = getAdminClient();

    // Ensure rewards are initialized for the user
    const { PhaseRewardsInitializer } = await import('@/lib/services/phase-rewards-initializer');
    await PhaseRewardsInitializer.ensureRewardsExist(userId);

    // Get active phase rewards
    const { data, error } = await supabaseAdmin
      .rpc('get_active_phase_rewards', { p_user_id: userId });

    if (error) {
      console.error('[Profile Rewards] Error fetching rewards:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rewards' },
        { status: 500 }
      );
    }

    // Return first reward (should only be one per month)
    const reward = data && data.length > 0 ? (data[0] as PhaseReward) : null;

    const { getPhaseLevels } = await import('@/modules/phase-levels/services/phase-level-service');

    const phaseLevels = await getPhaseLevels();
    const configurations: PhaseRewardConfiguration[] = phaseLevels.map((level) => ({
      phase: level.level,
      creditCents: level.creditCents,
      freeProductValueCents: level.freeProductValueCents ?? (level.level === 1 ? 6500 : 0),
    }));

    return NextResponse.json({
      reward,
      configurations,
    });
  } catch (error) {
    console.error('[Profile Rewards] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
