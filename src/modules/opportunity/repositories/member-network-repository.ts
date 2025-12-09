import type { MemberNetworkSnapshot } from '../domain/models/member-network';

export interface MemberNetworkRepository {
  getNetworkSnapshot(memberId: string): Promise<MemberNetworkSnapshot | null>;
}

export class InMemoryMemberNetworkRepository implements MemberNetworkRepository {
  constructor(private readonly snapshots: Map<string, MemberNetworkSnapshot>) {}

  async getNetworkSnapshot(memberId: string): Promise<MemberNetworkSnapshot | null> {
    return this.snapshots.get(memberId) ?? null;
  }
}
