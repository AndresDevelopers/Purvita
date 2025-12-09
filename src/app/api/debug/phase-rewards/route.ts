import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { withAdminAuth } from '@/lib/auth/with-auth';

/**
 * Debug endpoint to check phase rewards data
 * GET /api/debug/phase-rewards?userId=xxx
 *
 * Requires: Admin authentication (access_admin_panel permission)
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const supabaseAdmin = getAdminClient();
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get user's current phase
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .select('phase_id, phases(phase, ecommerce_commission)')
      .eq('user_id', userId)
      .single();

    if (membershipError) {
      console.error('[Debug Phase Rewards] Error fetching membership:', membershipError);
    }

    // Get active phase rewards
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .rpc('get_active_phase_rewards', { p_user_id: userId });

    if (rewardsError) {
      console.error('[Debug Phase Rewards] Error fetching rewards:', rewardsError);
    }

    // Get all phase rewards (not just active)
    const { data: allRewards, error: allRewardsError } = await supabaseAdmin
      .from('phase_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (allRewardsError) {
      console.error('[Debug Phase Rewards] Error fetching all rewards:', allRewardsError);
    }

    return NextResponse.json({
      userId,
      membership,
      activeRewards: rewards,
      allRewards,
      errors: {
        membership: membershipError ? membershipError.message : null,
        rewards: rewardsError ? rewardsError.message : null,
        allRewards: allRewardsError ? allRewardsError.message : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Debug Phase Rewards] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})
