import type { SupabaseClient } from '@supabase/supabase-js';
import type { getAppSettings as _getAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { SentryLogger } from '../../observability/services/sentry-logger';
import type { SubscriptionRecord } from '../domain/types';

export interface SubscriptionCommissionEntry {
  userId: string;
  memberId: string;
  level: number;
  amountCents: number;
}

/**
 * Service to calculate and create network commissions when users pay their monthly subscription
 *
 * NOTE: Level earnings-based commissions have been removed.
 * This service now returns empty results as subscription payments no longer generate
 * network commissions based on level earnings.
 *
 * Only sponsors with ACTIVE subscriptions would have received commissions (when feature was active).
 */
export class SubscriptionCommissionService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Process subscription commission when a user's subscription becomes active
   * @param subscription - The subscription record that was updated
   * @param wasActive - Whether the subscription was already active before this update
   */
  async processSubscriptionCommission(
    subscription: SubscriptionRecord,
    wasActive: boolean = false
  ): Promise<SubscriptionCommissionEntry[]> {
    // Only process if subscription is now active and wasn't active before
    if (subscription.status !== 'active' || wasActive) {
      console.log(`[SubscriptionCommissionService] Skipping commission processing: status=${subscription.status}, wasActive=${wasActive}`);
      return [];
    }

    console.log(`[SubscriptionCommissionService] Processing subscription commission for user ${subscription.user_id}`);

    try {
      return await this.calculateAndCreateSubscriptionCommissions(subscription.user_id);
    } catch (error) {
      SentryLogger.captureSubscriptionError(error, {
        operation: 'process_subscription_commission',
        userId: subscription.user_id,
        subscriptionId: subscription.id,
        status: subscription.status,
        extra: {
          subscription,
          error,
        },
      });
      console.error(`[SubscriptionCommissionService] Error processing subscription commission:`, error);
      return [];
    }
  }

  /**
   * Calculate and create network commissions for a subscription payment
   * @param subscriberId - The user who paid their subscription
   * @returns Array of created commission entries
   *
   * NOTE: Level earnings-based commissions have been removed.
   * This function now returns an empty array as subscription payments
   * no longer generate network commissions based on level earnings.
   */
  private async calculateAndCreateSubscriptionCommissions(
    subscriberId: string
  ): Promise<SubscriptionCommissionEntry[]> {
    console.log(`[SubscriptionCommissionService] Subscription commissions based on level earnings have been disabled for user ${subscriberId}`);
    return [];
  }

  /**
   * Check if a user has an active subscription
   * @param userId - The user ID to check
   * @returns true if the user has an active subscription, false otherwise
   */
  private async checkActiveSubscription(userId: string): Promise<boolean> {
    try {
      const { data, error} = await this.client
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn(`[SubscriptionCommissionService] Error checking subscription for user ${userId}:`, error);
        return false;
      }

      if (!data) {
        return false;
      }

      // User must have active status
      return data.status === 'active';
    } catch (error) {
      console.warn(`[SubscriptionCommissionService] Exception checking subscription for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get the upline chain for a user (their sponsors up the tree)
   * @param userId - The user to get upline for
   * @param maxLevels - Maximum number of levels to traverse
   * @returns Array of user IDs representing the upline chain
   */
  private async getUplineChain(userId: string, maxLevels: number): Promise<string[]> {
    const upline: string[] = [];
    let currentUserId = userId;

    for (let level = 0; level < maxLevels; level++) {
      try {
        const { data, error } = await this.client
          .from('profiles')
          .select('sponsor_id')
          .eq('id', currentUserId)
          .maybeSingle();

        if (error || !data || !data.sponsor_id) {
          break;
        }

        upline.push(data.sponsor_id);
        currentUserId = data.sponsor_id;
      } catch (error) {
        console.warn(`[SubscriptionCommissionService] Error getting upline for user ${currentUserId}:`, error);
        break;
      }
    }

    return upline;
  }

  /**
   * Check if a sponsor has reached the maximum member limit for a specific level
   * @param sponsorId - The sponsor's user ID
   * @param level - The level to check (1, 2, 3, etc.)
   * @param settings - App settings containing maxMembersPerLevel configuration
   * @returns true if the sponsor has reached the limit, false otherwise
   */
  private async hasReachedMemberLimit(
    sponsorId: string,
    level: number,
    settings: unknown
  ): Promise<boolean> {
    try {
      // Get the maximum members allowed for this level
      const levelCapacity = (settings as any).maxMembersPerLevel.find((c: any) => c.level === level);
      if (!levelCapacity || levelCapacity.maxMembers <= 0) {
        console.log(`[SubscriptionCommissionService] No capacity limit configured for level ${level}, allowing commission`);
        return false;
      }

      const maxMembers = levelCapacity.maxMembers;

      // Count how many active members this sponsor has at this level
      // We need to count members who are at the correct distance from the sponsor
      const activeMembersCount = await this.countActiveMembersAtLevel(sponsorId, level);

      console.log(`[SubscriptionCommissionService] Sponsor ${sponsorId} level ${level}: ${activeMembersCount}/${maxMembers} members`);

      return activeMembersCount >= maxMembers;
    } catch (error) {
      console.warn(`[SubscriptionCommissionService] Error checking member limit for sponsor ${sponsorId} level ${level}:`, error);
      // In case of error, allow the commission to be safe
      return false;
    }
  }

  /**
   * Count how many active members a sponsor has at a specific level
   * @param sponsorId - The sponsor's user ID
   * @param level - The level to count (1 = direct referrals, 2 = second level, etc.)
   * @returns Number of active members at that level
   */
  private async countActiveMembersAtLevel(sponsorId: string, level: number): Promise<number> {
    try {
      // For level 1 (direct referrals), count direct sponsored users with active subscriptions
      if (level === 1) {
        const { count, error } = await this.client
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('sponsor_id', sponsorId)
          .eq('subscriptions.status', 'active')

        if (error) {
          console.warn(`[SubscriptionCommissionService] Error counting level 1 members for ${sponsorId}:`, error);
          return 0;
        }

        return count || 0;
      }

      // For levels 2+, we need to traverse the network tree
      // This is more complex and requires recursive counting
      return await this.countMembersAtDepth(sponsorId, level);
    } catch (error) {
      console.warn(`[SubscriptionCommissionService] Error counting members at level ${level} for sponsor ${sponsorId}:`, error);
      return 0;
    }
  }

  /**
   * Count members at a specific depth in the network tree
   * @param sponsorId - The sponsor's user ID
   * @param targetLevel - The target level/depth to count
   * @returns Number of active members at that depth
   */
  private async countMembersAtDepth(sponsorId: string, targetLevel: number): Promise<number> {
    // This is a simplified implementation. In a production system,
    // you might want to use a more efficient approach like:
    // 1. A materialized view that pre-calculates network depths
    // 2. A recursive CTE query
    // 3. A cached network structure

    let currentLevelUsers = [sponsorId];

    for (let currentLevel = 1; currentLevel <= targetLevel; currentLevel++) {
      if (currentLevelUsers.length === 0) {
        return 0;
      }

      // Get all direct referrals of current level users
      const { data, error } = await this.client
        .from('profiles')
        .select('id, subscriptions!inner(status)')
        .in('sponsor_id', currentLevelUsers);

      if (error) {
        console.warn(`[SubscriptionCommissionService] Error getting level ${currentLevel} members:`, error);
        return 0;
      }

      if (currentLevel === targetLevel) {
        // We've reached the target level, count active members
        return data.filter((profile: any) =>
          profile.subscriptions?.status === 'active'
        ).length;
      }

      // Prepare for next level - only include active members as they can sponsor others
      currentLevelUsers = data
        .filter((profile: any) =>
          profile.subscriptions?.status === 'active' &&
          true
        )
        .map((profile: any) => profile.id);
    }

    return 0;
  }

  /**
   * Check if a user was previously active (to avoid duplicate commissions)
   * This method can be enhanced to track subscription history if needed
   * @param userId - The user ID to check
   * @returns true if the user had an active subscription in the recent past
   */
  async wasSubscriptionPreviouslyActive(userId: string): Promise<boolean> {
    // For now, we'll assume if they have any recent subscription commissions,
    // they were previously active. This can be enhanced with subscription history tracking.
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const { data, error } = await this.client
        .from('network_commissions')
        .select('id')
        .eq('member_id', userId)
        .eq('metadata->>commission_type', 'subscription_payment')
        .gte('created_at', oneMonthAgo.toISOString())
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn(`[SubscriptionCommissionService] Error checking previous subscription activity for user ${userId}:`, error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.warn(`[SubscriptionCommissionService] Exception checking previous subscription activity for user ${userId}:`, error);
      return false;
    }
  }
}
