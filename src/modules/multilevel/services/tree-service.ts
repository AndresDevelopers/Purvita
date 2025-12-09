import type { SupabaseClient } from '@supabase/supabase-js';
import type { TreeMember, MultilevelTreeResponse, TwoLevelTreeResponse } from '../domain/types';
import type { getCachedAppSettings as _getCachedAppSettings } from '@/lib/helpers/settings-helper';

/**
 * Raw tree row from database RPC function
 * Uses unknown types because Supabase RPC returns untyped data
 */
type TreeRow = {
  descendant?: unknown;
  email?: unknown;
  name?: unknown;
  status?: unknown;
  level?: unknown;
  phase?: unknown;
  allow_team_messages?: unknown;
};

/**
 * Type guard to validate tree row structure
 */
function isValidTreeRow(row: TreeRow): row is Required<TreeRow> {
  return (
    typeof row.descendant === 'string' &&
    typeof row.email === 'string' &&
    (typeof row.status === 'string' || row.status === null) &&
    (typeof row.level === 'number' || typeof row.level === 'string') &&
    (typeof row.phase === 'number' || row.phase === null)
  );
}

export class TreeService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Parse a tree row into a TreeMember object
   * Centralizes type checking and conversion logic
   */
  private parseTreeRow(record: TreeRow): TreeMember | null {
    // Early validation using type guard
    if (!isValidTreeRow(record)) {
      return null;
    }

    const status = typeof record.status === 'string' ? (record.status as TreeMember['status']) : null;
    const level =
      typeof record.level === 'number'
        ? record.level
        : Number.parseInt(record.level as string, 10);
    const name = typeof record.name === 'string' ? (record.name as string) : null;
    const allowTeamMessages = typeof record.allow_team_messages === 'boolean' ? record.allow_team_messages : true;

    return {
      id: record.descendant as string,
      email: record.email as string,
      name,
      status,
      level,
      phase: record.phase as number,
      allowTeamMessages,
    };
  }

  /**
   * Fetch multilevel network tree with dynamic levels based on app settings
   * @param userId - The user ID to fetch the tree for
   * @param maxLevels - Optional max levels to fetch (defaults to 10)
   * @returns MultilevelTreeResponse with dynamic levels
   */
  async fetchMultilevelTree(userId: string, maxLevels?: number): Promise<MultilevelTreeResponse> {
    // Use a fixed depth of 10 levels if not specified
    if (!maxLevels) {
      maxLevels = 10;
    }

    const { data, error } = await this.client.rpc('fetch_multilevel_tree', {
      p_user: userId,
      p_max_levels: maxLevels,
    });

    if (error) {
      throw new Error(
        `Failed to fetch multilevel tree for user ${userId} with maxLevels ${maxLevels}: ${error.message}`,
        { cause: error }
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        `Invalid response from fetch_multilevel_tree: expected array, got ${typeof data}`
      );
    }

    const rows: TreeRow[] = data as TreeRow[];
    const levels: Record<number, TreeMember[]> = {};
    let maxLevel = 0;

    for (const record of rows) {
      const member = this.parseTreeRow(record);
      
      if (!member || member.level < 1) {
        continue;
      }

      if (!levels[member.level]) {
        levels[member.level] = [];
      }

      levels[member.level].push(member);
      maxLevel = Math.max(maxLevel, member.level);
    }

    return { levels, maxLevel };
  }

  /**
   * Legacy method for backward compatibility
   * Fetches only 2 levels and returns in the old format
   */
  async fetchTwoLevelTree(userId: string): Promise<TwoLevelTreeResponse> {
    const { data, error } = await this.client.rpc('fetch_two_level_tree', {
      p_user: userId,
    });

    if (error) {
      throw new Error(
        `Failed to fetch two-level tree for user ${userId}: ${error.message}`,
        { cause: error }
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        `Invalid response from fetch_two_level_tree: expected array, got ${typeof data}`
      );
    }

    const level1: TreeMember[] = [];
    const level2: TreeMember[] = [];
    const rows: TreeRow[] = data as TreeRow[];

    for (const record of rows) {
      const member = this.parseTreeRow(record);
      
      if (!member) {
        continue;
      }

      if (member.level === 1) {
        level1.push(member);
      } else if (member.level === 2) {
        level2.push(member);
      }
    }

    return { level1, level2 };
  }
}
