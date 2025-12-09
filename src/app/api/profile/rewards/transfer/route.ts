import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

/**
 * POST /api/profile/rewards/transfer
 * Transfer phase rewards (store credit) to network earnings balance
 * Only available for Phase 2 and Phase 3 users
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    // ✅ SECURITY FIX: Use proper Supabase authentication instead of x-user-id header
    // Previous implementation used x-user-id header which could be spoofed by attackers
    const supabase = await createSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id; // ✅ This userId is authenticated and cannot be spoofed

    const supabaseAdmin = getAdminClient();

    // Get active phase rewards
    const { data: rewardsData, error: rewardsError } = await supabaseAdmin
      .rpc('get_active_phase_rewards', { p_user_id: userId });

    if (rewardsError) {
      console.error('[Transfer Rewards] Error fetching rewards:', rewardsError);
      return NextResponse.json(
        { error: 'Failed to fetch phase rewards' },
        { status: 500 }
      );
    }

    if (!rewardsData || rewardsData.length === 0) {
      return NextResponse.json(
        { error: 'No active rewards found' },
        { status: 404 }
      );
    }

    const reward = rewardsData[0];
    const phase = reward.phase;
    const creditRemaining = reward.credit_remaining_cents;

    // Validate phase (only Phase 2 and 3 can transfer)
    if (phase < 2 || phase > 3) {
      return NextResponse.json(
        { error: 'Only Phase 2 and Phase 3 users can transfer rewards to earnings' },
        { status: 403 }
      );
    }

    // Validate there's credit to transfer
    if (creditRemaining <= 0) {
      return NextResponse.json(
        { error: 'No store credit available to transfer' },
        { status: 400 }
      );
    }

    // Execute transfer using database function
    const { data: transferResult, error: transferError } = await supabaseAdmin
      .rpc('transfer_phase_rewards_to_earnings', { p_user_id: userId });

    if (transferError) {
      console.error('[Transfer Rewards] Error executing transfer:', transferError);
      return NextResponse.json(
        { error: 'Failed to transfer rewards' },
        { status: 500 }
      );
    }

    if (!transferResult || transferResult.length === 0) {
      return NextResponse.json(
        { error: 'Transfer function returned no result' },
        { status: 500 }
      );
    }

    const result = transferResult[0];

    if (!result.success) {
      console.error('[Transfer Rewards] Transfer failed:', result.error_message);
      return NextResponse.json(
        { error: result.error_message || 'Transfer failed' },
        { status: 400 }
      );
    }

    // Get updated balances
    const { data: updatedRewards } = await supabaseAdmin
      .rpc('get_active_phase_rewards', { p_user_id: userId });

    const { data: networkCommissions } = await supabaseAdmin
      .from('network_commissions')
      .select('amount_cents')
      .eq('user_id', userId)
      .eq('status', 'available');

    const totalEarningsCents = networkCommissions?.reduce(
      (sum, comm) => sum + (comm.amount_cents || 0),
      0
    ) || 0;

    return NextResponse.json({
      success: true,
      transferredCents: creditRemaining,
      updatedReward: updatedRewards?.[0] || null,
      totalEarningsCents,
    });
  } catch (error) {
    console.error('[Transfer Rewards] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
