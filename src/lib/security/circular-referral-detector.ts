import type { SupabaseClient } from '@supabase/supabase-js';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';

/**
 * Circular Referral Detector
 *
 * Detects and prevents circular referrals in the MLM structure
 * using Depth-First Search (DFS) algorithm to find cycles.
 *
 * Example of circular referral:
 * User A refers User B
 * User B refers User C
 * User C refers User A (creates a cycle)
 */

export class CircularReferralDetector {
  private visited: Set<string> = new Set();
  private recursionStack: Set<string> = new Set();

  constructor(private readonly client: SupabaseClient) {}

  /**
   * Checks if adding a new referral relationship would create a cycle
   *
   * @param newUserId - The ID of the new user being referred
   * @param referrerId - The ID of the user who is referring
   * @returns true if a cycle would be created, false otherwise
   */
  async wouldCreateCycle(newUserId: string, referrerId: string): Promise<boolean> {
    // Reset state for new check
    this.visited = new Set();
    this.recursionStack = new Set();

    try {
      // If the new user would be referred by someone,
      // check if that someone is already in the new user's downline
      const hasCycle = await this.detectCycleFromNode(referrerId, newUserId);

      if (hasCycle) {
        console.warn('[CircularReferralDetector] Cycle detected!', {
          newUserId,
          referrerId,
        });

        // Log security event
        await SecurityAuditLogger.log(
          SecurityEventType.FRAUD_DETECTED,
          SecurityEventSeverity.HIGH,
          'Circular referral attempt detected',
          {
            newUserId,
            referrerId,
            action: 'circular_referral_blocked',
          },
          false
        );
      }

      return hasCycle;
    } catch (error) {
      console.error('[CircularReferralDetector] Error detecting cycle:', error);
      // On error, be conservative and assume there might be a cycle
      return true;
    }
  }

  /**
   * Performs DFS to detect if there's a path from startNode to targetNode
   * This would indicate that targetNode is in startNode's upline,
   * so making targetNode refer startNode would create a cycle.
   *
   * @param currentNode - Current node in the traversal
   * @param targetNode - Node we're looking for
   * @returns true if a path exists (cycle would be created)
   */
  private async detectCycleFromNode(currentNode: string, targetNode: string): Promise<boolean> {
    // If we've reached the target node, we found a cycle
    if (currentNode === targetNode) {
      return true;
    }

    // Mark as visited
    this.visited.add(currentNode);
    this.recursionStack.add(currentNode);

    // Get the upline of the current node (who referred them)
    const { data: profile, error } = await this.client
      .from('profiles')
      .select('sponsor_id')
      .eq('id', currentNode)
      .single();

    if (error || !profile || !profile.sponsor_id) {
      // No upline, so no cycle possible from here
      this.recursionStack.delete(currentNode);
      return false;
    }

    // If the sponsor is in our recursion stack, we found a cycle
    if (this.recursionStack.has(profile.sponsor_id)) {
      console.warn('[CircularReferralDetector] Cycle found in recursion stack', {
        currentNode,
        sponsor: profile.sponsor_id,
      });
      return true;
    }

    // If we haven't visited the sponsor yet, traverse to it
    if (!this.visited.has(profile.sponsor_id)) {
      const cycleFound = await this.detectCycleFromNode(profile.sponsor_id, targetNode);
      if (cycleFound) {
        return true;
      }
    }

    // Remove from recursion stack as we backtrack
    this.recursionStack.delete(currentNode);
    return false;
  }

  /**
   * Validates the entire referral chain for a user
   * Useful for data integrity checks
   *
   * @param userId - The user ID to start validation from
   * @returns Object with validation results
   */
  async validateReferralChain(userId: string): Promise<{
    valid: boolean;
    maxDepth: number;
    chainLength: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let currentUserId: string | null = userId;
    let depth = 0;
    const visitedNodes = new Set<string>();
    const MAX_DEPTH = 50; // Prevent infinite loops

    try {
      while (currentUserId && depth < MAX_DEPTH) {
        // Check for cycles
        if (visitedNodes.has(currentUserId)) {
          errors.push(`Cycle detected at user ${currentUserId}`);
          break;
        }

        visitedNodes.add(currentUserId);

        // Get sponsor
        const { data: profile } = await this.client
          .from('profiles')
          .select('sponsor_id')
          .eq('id', currentUserId)
          .single();

        if (!profile) {
          break;
        }

        currentUserId = profile.sponsor_id;
        depth++;
      }

      if (depth >= MAX_DEPTH) {
        errors.push('Maximum referral chain depth exceeded');
      }

      return {
        valid: errors.length === 0,
        maxDepth: MAX_DEPTH,
        chainLength: depth,
        errors,
      };
    } catch (error) {
      console.error('[CircularReferralDetector] Error validating chain:', error);
      return {
        valid: false,
        maxDepth: MAX_DEPTH,
        chainLength: depth,
        errors: ['Error during validation'],
      };
    }
  }

  /**
   * Finds all cycles in the referral network
   * WARNING: This can be expensive for large networks
   *
   * @returns Array of detected cycles
   */
  async findAllCycles(): Promise<Array<{ userId: string; cycleLength: number }>> {
    const cycles: Array<{ userId: string; cycleLength: number }> = [];

    try {
      // Get all users with sponsors
      const { data: profiles } = await this.client
        .from('profiles')
        .select('id, sponsor_id')
        .not('sponsor_id', 'is', null);

      if (!profiles) {
        return cycles;
      }

      // Check each user for cycles
      for (const profile of profiles) {
        this.visited = new Set();
        this.recursionStack = new Set();

        const hasCycle = await this.detectCycleFromNode(profile.id, profile.id);
        if (hasCycle) {
          cycles.push({
            userId: profile.id,
            cycleLength: this.recursionStack.size,
          });
        }
      }

      return cycles;
    } catch (error) {
      console.error('[CircularReferralDetector] Error finding all cycles:', error);
      return cycles;
    }
  }
}

/**
 * Helper function to check if a referral would create a cycle
 *
 * @param client - Supabase client
 * @param newUserId - The ID of the new user
 * @param referrerId - The ID of the referrer
 * @returns true if cycle would be created
 */
export async function wouldCreateCircularReferral(
  client: SupabaseClient,
  newUserId: string,
  referrerId: string
): Promise<boolean> {
  const detector = new CircularReferralDetector(client);
  return detector.wouldCreateCycle(newUserId, referrerId);
}
