import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  NetworkLevelSnapshot,
  NetworkMember,
  NetworkOverview,
  NetworkMemberStatus,
  TreeMember,
} from '../domain/types';
import { TreeService } from './tree-service';

const determineMemberStatus = (member: TreeMember): NetworkMemberStatus => {
  // Only consider users with canceled or past_due subscriptions as "inactive" (needs attention)
  // These are users who had a subscription but canceled/suspended it, meaning the sponsor won't receive commissions
  // Users without subscriptions or with other statuses are not counted as "needs attention"
  if (member.status === 'canceled' || member.status === 'past_due') {
    return 'inactive';
  }

  return 'active';
};

const buildSnapshot = (
  members: NetworkMember[],
  level: number,
): NetworkLevelSnapshot => {
  const total = members.length;
  let active = 0;
  let inactive = 0;

  members.forEach((member) => {
    const status = determineMemberStatus(member);

    if (status === 'active') {
      active += 1;
      return;
    }

    inactive += 1;
  });

  return {
    level,
    total,
    active,
    inactive,
  };
};

export class NetworkOverviewService {
  private readonly tree: TreeService;

  constructor(client: SupabaseClient) {
    this.tree = new TreeService(client);
  }

  async getOverview(userId: string): Promise<NetworkOverview> {
    // Fetch multilevel tree
    const multilevelTree = await this.tree.fetchMultilevelTree(userId);

    const mapToNetworkMember = (members: TreeMember[]): NetworkMember[] =>
      members.map((member) => ({
        ...member,
        statusCategory: determineMemberStatus(member),
      }));

    // Build snapshots for all levels
    const snapshots: NetworkLevelSnapshot[] = [];
    const allMembers: NetworkMember[] = [];

    Object.entries(multilevelTree.levels).forEach(([levelStr, members]) => {
      const level = Number(levelStr);
      const networkMembers = mapToNetworkMember(members);

      snapshots.push(buildSnapshot(networkMembers, level));
      allMembers.push(...networkMembers);
    });

    // Sort snapshots by level
    snapshots.sort((a, b) => a.level - b.level);

    const totals = snapshots.reduce(
      (acc, snapshot) => ({
        totalMembers: acc.totalMembers + snapshot.total,
        activeMembers: acc.activeMembers + snapshot.active,
        inactiveMembers: acc.inactiveMembers + snapshot.inactive,
      }),
      {
        totalMembers: 0,
        activeMembers: 0,
        inactiveMembers: 0,
      },
    );

    // Sort members by level and email
    const members = allMembers.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
    });

    return {
      ...totals,
      levels: snapshots,
      members,
    };
  }
}
