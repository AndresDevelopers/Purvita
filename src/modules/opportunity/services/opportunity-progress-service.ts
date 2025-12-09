import {
  MemberNetworkSnapshotSchema,
  computeActiveCounts,
  type MemberNetworkSnapshot,
} from '../domain/models/member-network';
import {
  OpportunityPlan,
  OpportunityProgressSchema,
  type OpportunityProgress,
  type OpportunityPhase,
  type PhaseRequirement,
} from '../domain/models/opportunity-plan';
import { OpportunityProgressNotifier } from '../domain/events/opportunity-progress-observer';
import type { MemberNetworkRepository } from '../repositories/member-network-repository';

export type OpportunityProgressServiceDependencies = {
  memberNetworkRepository: MemberNetworkRepository;
  notifier?: OpportunityProgressNotifier;
  nowProvider?: () => Date;
};

export class OpportunityProgressService {
  private readonly notifier: OpportunityProgressNotifier;
  private readonly nowProvider: () => Date;

  constructor(
    private readonly plan: OpportunityPlan,
    private readonly dependencies: OpportunityProgressServiceDependencies,
  ) {
    this.notifier = dependencies.notifier ?? new OpportunityProgressNotifier();
    this.nowProvider = dependencies.nowProvider ?? (() => new Date());
  }

  async evaluate(memberId: string): Promise<OpportunityProgress> {
    const snapshot = await this.dependencies.memberNetworkRepository.getNetworkSnapshot(memberId);
    if (!snapshot) {
      throw new Error(`Unable to evaluate opportunity progress: member ${memberId} has no network snapshot.`);
    }

    const validatedSnapshot = MemberNetworkSnapshotSchema.parse(snapshot);
    const counts = computeActiveCounts(validatedSnapshot);

    const phaseProgress = this.plan.phases.map((phase) => {
      const unlocked = this.isRequirementMet(phase, validatedSnapshot);
      if (unlocked) {
        this.notifier.notifyPhaseUnlocked(memberId, phase.id);
      }

      return {
        phaseId: phase.id,
        isUnlocked: unlocked,
        unlockedAt: unlocked ? this.resolveUnlockTimestamp(validatedSnapshot) : null,
      };
    });

    const lastUnlockedPhase = [...phaseProgress]
      .reverse()
      .find((progress) => progress.isUnlocked)?.phaseId ?? this.plan.phases[0]?.id ?? 'phase0';

    const progress: OpportunityProgress = {
      memberId,
      currentPhaseId: lastUnlockedPhase,
      phaseProgress,
      totalActiveMembers: counts.totalActiveMembers,
      directActiveMembers: counts.directActiveMembers,
      secondLevelActiveMembers: counts.secondLevelActiveMembers,
      qualifyingProvider: validatedSnapshot.owner.subscription.provider,
    };

    return OpportunityProgressSchema.parse(progress);
  }

  private resolveUnlockTimestamp(snapshot: MemberNetworkSnapshot): string {
    const candidateDates = [
      snapshot.owner.subscription.activeSince,
      snapshot.owner.subscription.lastPaymentAt,
      this.nowProvider().toISOString(),
    ].filter((value): value is string => Boolean(value));

    return candidateDates[0] ?? this.nowProvider().toISOString();
  }

  private isRequirementMet(phase: OpportunityPhase, snapshot: MemberNetworkSnapshot): boolean {
    const requirement = phase.requirement;

    switch (requirement.type) {
      case 'subscriptionActive':
        return this.validateSubscriptionRequirement(snapshot, requirement as Extract<PhaseRequirement, { type: 'subscriptionActive' }>);
      case 'directActiveRecruits':
        return this.validateDirectRequirement(snapshot, requirement as Extract<PhaseRequirement, { type: 'directActiveRecruits' }>);
      case 'secondLevelActiveRecruits':
        return this.validateSecondLevelRequirement(snapshot, requirement as Extract<PhaseRequirement, { type: 'secondLevelActiveRecruits' }>);
      case 'networkRetention':
        return this.validateNetworkRetention(snapshot, requirement as Extract<PhaseRequirement, { type: 'networkRetention' }>);
      default: {
        const exhaustiveCheck: never = requirement;
        throw new Error(`Unhandled requirement type ${(exhaustiveCheck as PhaseRequirement).type}`);
      }
    }
  }

  private validateSubscriptionRequirement(
    snapshot: MemberNetworkSnapshot,
    requirement: Extract<PhaseRequirement, { type: 'subscriptionActive' }>,
  ): boolean {
    const { owner } = snapshot;
    if (!owner.subscription.isActive) {
      return false;
    }

    if (!owner.subscription.activeSince) {
      return false;
    }

    const activeSince = new Date(owner.subscription.activeSince);
    const minimumStart = new Date(this.nowProvider());
    minimumStart.setMonth(minimumStart.getMonth() - (requirement as any).minimumConsecutiveMonths);

    return activeSince <= minimumStart;
  }

  private validateDirectRequirement(
    snapshot: MemberNetworkSnapshot,
    requirement: Extract<PhaseRequirement, { type: 'directActiveRecruits' }>,
  ): boolean {
    const activeDirects = snapshot.directRecruits.filter((direct) => {
      if (!direct.subscription.isActive) {
        return false;
      }

      if (!(requirement as any).requirePaidInvoiceThisCycle) {
        return true;
      }

      return this.isWithinCurrentBillingCycle(direct.subscription.lastPaymentAt);
    });

    return activeDirects.length >= (requirement as any).requiredActive;
  }

  private validateSecondLevelRequirement(
    snapshot: MemberNetworkSnapshot,
    requirement: Extract<PhaseRequirement, { type: 'secondLevelActiveRecruits' }>,
  ): boolean {
    const secondLevelActive = snapshot.directRecruits
      .flatMap((direct) => direct.recruits)
      .filter((node) => node.subscription.isActive);

    if (secondLevelActive.length < (requirement as any).requiredActive) {
      return false;
    }

    return snapshot.directRecruits.every((direct) => {
      const activeRecruits = direct.recruits.filter((recruit) => recruit.subscription.isActive);
      return activeRecruits.length >= (requirement as any).minimumPerDirect;
    });
  }

  private validateNetworkRetention(
    snapshot: MemberNetworkSnapshot,
    requirement: Extract<PhaseRequirement, { type: 'networkRetention' }>,
  ): boolean {
    const levels: MemberNetworkSnapshot['owner'][] = [];
    levels.push(snapshot.owner);

    if ((requirement as any).requiredLevels >= 1) {
      for (const direct of snapshot.directRecruits) {
        levels.push(direct);
      }
    }

    if ((requirement as any).requiredLevels >= 2) {
      for (const direct of snapshot.directRecruits) {
        for (const recruit of direct.recruits) {
          levels.push(recruit);
        }
      }
    }

    return levels.every((node) => node.subscription.isActive && this.isWithinCurrentBillingCycle(node.subscription.lastPaymentAt));
  }

  private isWithinCurrentBillingCycle(lastPaymentAt: string | null): boolean {
    if (!lastPaymentAt) {
      return false;
    }

    const lastPaymentDate = new Date(lastPaymentAt);
    const now = this.nowProvider();

    const billingWindow = new Date(now);
    billingWindow.setDate(now.getDate() - 31);

    return lastPaymentDate >= billingWindow;
  }
}
