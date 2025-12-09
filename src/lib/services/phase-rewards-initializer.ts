/**
 * Phase Rewards Initializer
 * Creates phase reward records when users reach a new phase
 */

import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

export interface InitializeRewardResult {
  success: boolean;
  rewardId?: string;
  alreadyExists?: boolean;
  error?: string;
}

export class PhaseRewardsInitializer {
  /**
   * Initialize phase rewards for a user's current phase
   * Creates a new reward record if one doesn't exist for the current month
   */
  static async initializeForUser(userId: string, phase: number): Promise<InitializeRewardResult> {
    if (phase < 1 || phase > 3) {
      return {
        success: false,
        error: 'Invalid phase. Must be between 1 and 3.',
      };
    }

    const supabase = getAdminClient();

    try {
      // Check if there's already an active reward for this month
      const { data: existingRewards, error: checkError } = await supabase
        .rpc('get_active_phase_rewards', { p_user_id: userId });

      if (checkError) {
        console.error('[PhaseRewardsInitializer] Error checking existing rewards:', checkError);
        return {
          success: false,
          error: 'Failed to check existing rewards',
        };
      }

      const existingReward = existingRewards && existingRewards.length > 0 ? existingRewards[0] : null;

      if (existingReward && existingReward.phase >= phase) {
        return {
          success: true,
          rewardId: existingReward.reward_id,
          alreadyExists: true,
        };
      }

      const { data: rewardId, error: grantError } = await supabase
        .rpc('grant_phase_reward', {
          p_user_id: userId,
          p_phase: phase,
        });

      if (grantError) {
        console.error('[PhaseRewardsInitializer] Error granting reward via RPC:', grantError);
        return {
          success: false,
          error: 'Failed to grant phase reward',
        };
      }

      return {
        success: true,
        rewardId: rewardId ?? existingReward?.reward_id,
        alreadyExists: Boolean(existingReward),
      };
    } catch (error) {
      console.error('[PhaseRewardsInitializer] Unexpected error:', error);
      return {
        success: false,
        error: 'Unexpected error occurred',
      };
    }
  }

  /**
   * Ensure a user has phase rewards initialized
   * This should be called when loading the profile or when phase changes
   */
  static async ensureRewardsExist(userId: string): Promise<void> {
    const supabase = getAdminClient();

    try {
      // Get user's current phase from the phases table directly
      // This is more reliable than using memberships table which might not be in cache
      const { data: userPhase, error: phaseError } = await supabase
        .from('phases')
        .select('phase')
        .eq('user_id', userId)
        .single();

      if (phaseError) {
        // If error code is PGRST116, it means no rows found (user doesn't have a phase yet)
        if (phaseError.code === 'PGRST116') {
          // User doesn't have a phase yet, no rewards to initialize
          return;
        }
        console.error('[PhaseRewardsInitializer] Error fetching phase:', phaseError);
        return;
      }

      if (!userPhase) {
        // User doesn't have a phase yet, no rewards to initialize
        return;
      }

      const phase = userPhase.phase;

      if (!phase || phase < 1) {
        // User doesn't have a valid phase yet, no rewards to initialize
        return;
      }

      // Initialize rewards for current phase
      await this.initializeForUser(userId, phase);
    } catch (error) {
      console.error('[PhaseRewardsInitializer] Error ensuring rewards exist:', error);
    }
  }
}
