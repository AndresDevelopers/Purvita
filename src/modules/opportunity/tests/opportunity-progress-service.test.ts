import { describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { DefaultOpportunityPlan } from '../config/mlm-plan';
import { OpportunityProgressService } from '../services/opportunity-progress-service';
import { InMemoryMemberNetworkRepository } from '../repositories/member-network-repository';
import type { MemberNetworkSnapshot, MemberSubscriptionStatus } from '../domain/models/member-network';
import { OpportunityProgressNotifier } from '../domain/events/opportunity-progress-observer';

const createActiveSubscription = (
  override: Partial<MemberSubscriptionStatus> = {},
): MemberSubscriptionStatus => ({
  isActive: true,
  provider: 'stripe',
  lastPaymentAt: new Date('2024-10-10T00:00:00.000Z').toISOString(),
  activeSince: new Date('2024-07-01T00:00:00.000Z').toISOString(),
  ...override,
});

describe('OpportunityProgressService', () => {
  it('computes progress across all phases when network is fully active', async () => {
    const memberId = randomUUID();
    const directRecruitAId = randomUUID();
    const directRecruitBId = randomUUID();

    const snapshot: MemberNetworkSnapshot = {
      owner: {
        memberId,
        name: 'Alice',
        subscription: createActiveSubscription(),
        recruits: [],
      },
      directRecruits: [
        {
          memberId: directRecruitAId,
          name: 'Bob',
          subscription: createActiveSubscription(),
          recruits: [
            {
              memberId: randomUUID(),
              name: 'Charlie',
              subscription: createActiveSubscription(),
              recruits: [],
            },
            {
              memberId: randomUUID(),
              name: 'Diana',
              subscription: createActiveSubscription(),
              recruits: [],
            },
          ],
        },
        {
          memberId: directRecruitBId,
          name: 'Eva',
          subscription: createActiveSubscription(),
          recruits: [
            {
              memberId: randomUUID(),
              name: 'Frank',
              subscription: createActiveSubscription(),
              recruits: [],
            },
            {
              memberId: randomUUID(),
              name: 'Grace',
              subscription: createActiveSubscription(),
              recruits: [],
            },
          ],
        },
      ],
    };

    const repository = new InMemoryMemberNetworkRepository(new Map([[memberId, snapshot]]));
    const notifications: string[] = [];
    const notifier = new OpportunityProgressNotifier();
    notifier.subscribe({
      onPhaseUnlocked(unlockedMemberId, phaseId) {
        if (unlockedMemberId === memberId) {
          notifications.push(phaseId);
        }
      },
    });

    const service = new OpportunityProgressService(DefaultOpportunityPlan, {
      memberNetworkRepository: repository,
      notifier,
      nowProvider: () => new Date('2024-10-15T12:00:00.000Z'),
    });

    const progress = await service.evaluate(memberId);

    expect(progress.currentPhaseId).toBe('phase3');
    expect(progress.totalActiveMembers).toBe(7);
    expect(progress.directActiveMembers).toBe(2);
    expect(progress.secondLevelActiveMembers).toBe(4);
    expect(progress.phaseProgress.every((phase) => phase.isUnlocked)).toBe(true);
    expect(notifications).toEqual(['phase0', 'phase1', 'phase2', 'phase3']);
  });

  it('returns partial progress when only subscription requirement is met', async () => {
    const memberId = randomUUID();

    const snapshot: MemberNetworkSnapshot = {
      owner: {
        memberId,
        name: 'Isabella',
        subscription: createActiveSubscription({ activeSince: new Date('2024-08-01T00:00:00.000Z').toISOString() }),
        recruits: [],
      },
      directRecruits: [
        {
          memberId: randomUUID(),
          name: 'Jack',
          subscription: {
            isActive: false,
            provider: 'paypal',
            lastPaymentAt: null,
            activeSince: null,
          },
          recruits: [],
        },
      ],
    };

    const repository = new InMemoryMemberNetworkRepository(new Map([[memberId, snapshot]]));
    const service = new OpportunityProgressService(DefaultOpportunityPlan, {
      memberNetworkRepository: repository,
      nowProvider: () => new Date('2024-09-01T00:00:00.000Z'),
    });

    const progress = await service.evaluate(memberId);

    expect(progress.currentPhaseId).toBe('phase0');
    expect(progress.phaseProgress.find((phase) => phase.phaseId === 'phase0')?.isUnlocked).toBe(true);
    expect(progress.phaseProgress.find((phase) => phase.phaseId === 'phase1')?.isUnlocked).toBe(false);
  });

  it('throws a descriptive error when no snapshot is available', async () => {
    const memberId = randomUUID();
    const repository = new InMemoryMemberNetworkRepository(new Map());
    const service = new OpportunityProgressService(DefaultOpportunityPlan, {
      memberNetworkRepository: repository,
    });

    await expect(service.evaluate(memberId)).rejects.toThrow(
      `Unable to evaluate opportunity progress: member ${memberId} has no network snapshot.`,
    );
  });
});
