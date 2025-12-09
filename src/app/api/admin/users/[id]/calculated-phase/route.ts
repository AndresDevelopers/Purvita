import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { withAdminPermission } from '@/lib/auth/with-auth';

/**
 * GET /api/admin/users/[id]/calculated-phase
 * Calculate the automatic phase for a user based on their network activity
 * This ignores manual_phase_override to show what the system would calculate
 * Requires: manage_users permission
 */
export const GET = withAdminPermission('manage_users', async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const params = await context.params;
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    // Get user's subscription status
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();

    const subscriptionActive = subscription?.status === 'active';

    // Count ALL direct referrals (regardless of subscription status)
    const { data: directReferrals, error: directError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('referred_by', userId)
      .returns<{ id: string }[]>();

    if (directError) {
      console.error('[CalculatedPhase] Error fetching direct referrals:', directError);
      return NextResponse.json(
        { error: 'Failed to fetch direct referrals' },
        { status: 500 }
      );
    }

    const directReferralIds = (directReferrals ?? []).map((r) => r.id);
    const totalDirectReferrals = directReferralIds.length;

    // If user has no active subscription, return early with total counts
    if (!subscriptionActive) {
      return NextResponse.json({
        calculatedPhase: 0,
        directActiveCount: 0,
        totalDirectReferrals,
        secondLevelTotal: 0,
        minSecondLevel: 0,
        subscriptionActive: false,
      });
    }

    // Get active subscriptions for direct referrals
    const { data: activeDirectSubs, error: activeError } = await adminClient
      .from('subscriptions')
      .select('user_id')
      .in('user_id', directReferralIds.length > 0 ? directReferralIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'active');

    if (activeError) {
      console.error('[CalculatedPhase] Error fetching active subscriptions:', activeError);
      return NextResponse.json(
        { error: 'Failed to fetch active subscriptions' },
        { status: 500 }
      );
    }

    const directActiveCount = (activeDirectSubs ?? []).length;

    // Get second level referrals (referrals of direct referrals)
    const { data: secondLevelReferrals, error: secondLevelError } = await adminClient
      .from('profiles')
      .select('id, referred_by')
      .in('referred_by', directReferralIds.length > 0 ? directReferralIds : ['00000000-0000-0000-0000-000000000000'])
      .returns<{ id: string; referred_by: string }[]>();

    if (secondLevelError) {
      console.error('[CalculatedPhase] Error fetching second level referrals:', secondLevelError);
      return NextResponse.json(
        { error: 'Failed to fetch second level referrals' },
        { status: 500 }
      );
    }

    const secondLevelIds = (secondLevelReferrals ?? []).map((r) => r.id);

    // Get active subscriptions for second level
    const { data: activeSecondLevelSubs, error: activeSecondError } = await adminClient
      .from('subscriptions')
      .select('user_id')
      .in('user_id', secondLevelIds.length > 0 ? secondLevelIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'active');

    if (activeSecondError) {
      console.error('[CalculatedPhase] Error fetching second level active subscriptions:', activeSecondError);
      return NextResponse.json(
        { error: 'Failed to fetch second level active subscriptions' },
        { status: 500 }
      );
    }

    const activeSecondLevelUserIds = new Set((activeSecondLevelSubs ?? []).map((s) => s.user_id));
    const secondLevelTotal = activeSecondLevelUserIds.size;

    // Calculate minimum second level per direct referral
    const secondLevelByReferrer: Record<string, number> = {};
    (secondLevelReferrals ?? []).forEach((sl) => {
      if (activeSecondLevelUserIds.has(sl.id)) {
        secondLevelByReferrer[sl.referred_by] = (secondLevelByReferrer[sl.referred_by] ?? 0) + 1;
      }
    });

    const minSecondLevel = Object.keys(secondLevelByReferrer).length > 0
      ? Math.min(...Object.values(secondLevelByReferrer))
      : 0;

    // Calculate phase based on the same logic as recalculate_phase function
    let calculatedPhase = 0;

    const phase1 = subscriptionActive && directActiveCount >= 2;
    const phase2 = phase1 && secondLevelTotal >= 4 && minSecondLevel >= 2;
    const phase3 = phase2 && directActiveCount >= 2 && minSecondLevel >= 2;

    if (phase3) {
      calculatedPhase = 3;
    } else if (phase2) {
      calculatedPhase = 2;
    } else if (phase1) {
      calculatedPhase = 1;
    } else if (subscriptionActive) {
      calculatedPhase = 0;
    }

    return NextResponse.json({
      calculatedPhase,
      directActiveCount,
      totalDirectReferrals,
      secondLevelTotal,
      minSecondLevel,
      subscriptionActive,
    });
  } catch (error) {
    console.error('[CalculatedPhase] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

