/**
 * Phase Rewards Service
 * Handles application of phase rewards (free product and store credit) to purchases
 */

import { createClient } from '@supabase/supabase-js';
import { getPhaseCreditCents, getPhaseFreeProductValueCents } from '@/lib/helpers/settings-helper';

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

export interface PhaseRewardInfo {
  rewardId: string;
  phase: number;
  hasFreeProduct: boolean;
  freeProductUsed: boolean;
  creditRemainingCents: number;
  expiresAt: string | null;
}

export interface RewardApplicationResult {
  success: boolean;
  rewardType: 'free_product' | 'store_credit' | null;
  discountAppliedCents: number;
  remainingCreditCents?: number;
  error?: string;
}

export class PhaseRewardsService {
  /**
   * Get active phase rewards for a user
   */
  static async getActiveRewards(userId: string): Promise<PhaseRewardInfo | null> {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .rpc('get_active_phase_rewards', { p_user_id: userId });

    if (error) {
      console.error('[PhaseRewardsService] Error fetching rewards:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const reward = data[0];
    return {
      rewardId: reward.reward_id,
      phase: reward.phase,
      hasFreeProduct: reward.has_free_product,
      freeProductUsed: reward.free_product_used,
      creditRemainingCents: reward.credit_remaining_cents,
      expiresAt: reward.expires_at,
    };
  }

  /**
   * Calculate discount that can be applied based on user's phase rewards
   */
  static async calculateDiscount(
    userId: string,
    subtotalCents: number
  ): Promise<{ discountCents: number; rewardType: 'free_product' | 'store_credit' | null }> {
    const reward = await this.getActiveRewards(userId);

    if (!reward) {
      return { discountCents: 0, rewardType: null };
    }

    // Phase 1: Free product (up to $65)
    if (reward.phase === 1 && reward.hasFreeProduct && !reward.freeProductUsed) {
      const maxDiscount = await getPhaseFreeProductValueCents(reward.phase);
      return {
        discountCents: Math.min(subtotalCents, maxDiscount),
        rewardType: 'free_product',
      };
    }

    // Phase 2 & 3: Store credit
    if (reward.phase >= 2 && reward.creditRemainingCents > 0) {
      const configuredCredit = await getPhaseCreditCents(reward.phase);
      const creditCap = configuredCredit > 0 ? Math.min(reward.creditRemainingCents, configuredCredit) : reward.creditRemainingCents;
      return {
        discountCents: Math.min(subtotalCents, creditCap),
        rewardType: 'store_credit',
      };
    }

    return { discountCents: 0, rewardType: null };
  }

  /**
   * Apply phase reward discount to a purchase
   * This should be called after payment is confirmed
   */
  static async applyReward(
    userId: string,
    discountCents: number,
    rewardType: 'free_product' | 'store_credit'
  ): Promise<RewardApplicationResult> {
    const reward = await this.getActiveRewards(userId);

    if (!reward) {
      return {
        success: false,
        rewardType: null,
        discountAppliedCents: 0,
        error: 'No active rewards found',
      };
    }

    const supabase = getAdminClient();

    if (rewardType === 'free_product') {
      // Validate free product reward is available
      if (reward.phase !== 1 || !reward.hasFreeProduct || reward.freeProductUsed) {
        return {
          success: false,
          rewardType: null,
          discountAppliedCents: 0,
          error: 'Free product reward not available',
        };
      }

      const maxDiscount = await getPhaseFreeProductValueCents(reward.phase);
      const actualDiscount = Math.min(discountCents, maxDiscount);

      // Mark free product as used
      const { error } = await supabase
        .from('phase_rewards')
        .update({ free_product_used: true })
        .eq('id', reward.rewardId);

      if (error) {
        console.error('[PhaseRewardsService] Error marking free product as used:', error);
        return {
          success: false,
          rewardType: null,
          discountAppliedCents: 0,
          error: 'Failed to apply free product reward',
        };
      }

      return {
        success: true,
        rewardType: 'free_product',
        discountAppliedCents: actualDiscount,
      };
    }

    if (rewardType === 'store_credit') {
      // Validate store credit is available
      if (reward.phase < 2 || reward.creditRemainingCents <= 0) {
        return {
          success: false,
          rewardType: null,
          discountAppliedCents: 0,
          error: 'Store credit not available',
        };
      }

      const actualDiscount = Math.min(discountCents, reward.creditRemainingCents);
      const newBalance = reward.creditRemainingCents - actualDiscount;

      // Deduct from store credit
      const { error } = await supabase
        .from('phase_rewards')
        .update({ credit_remaining_cents: newBalance })
        .eq('id', reward.rewardId);

      if (error) {
        console.error('[PhaseRewardsService] Error deducting store credit:', error);
        return {
          success: false,
          rewardType: null,
          discountAppliedCents: 0,
          error: 'Failed to apply store credit',
        };
      }

      return {
        success: true,
        rewardType: 'store_credit',
        discountAppliedCents: actualDiscount,
        remainingCreditCents: newBalance,
      };
    }

    return {
      success: false,
      rewardType: null,
      discountAppliedCents: 0,
      error: 'Invalid reward type',
    };
  }
}
