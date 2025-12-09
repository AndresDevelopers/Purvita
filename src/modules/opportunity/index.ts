export type {
  OpportunityPhaseCopy,
  OpportunitySectionCopy,
  OpportunitySectionProps,
} from './components/opportunity-section';

export { OpportunitySection } from './components/opportunity-section';

export { DefaultOpportunityPlan } from './config/mlm-plan';
export { OpportunityPlanFactory } from './factories/opportunity-plan-factory';
export type {
  OpportunityPlan,
  OpportunityPhase,
  PhaseRequirement,
  OpportunityProgress,
  PhaseProgress,
} from './domain/models/opportunity-plan';
export type {
  MemberNetworkSnapshot,
  MemberNode,
  MemberSubscriptionStatus,
} from './domain/models/member-network';
export { OpportunityProgressService } from './services/opportunity-progress-service';
export type { OpportunityProgressServiceDependencies } from './services/opportunity-progress-service';
export type { MemberNetworkRepository } from './repositories/member-network-repository';
export { InMemoryMemberNetworkRepository } from './repositories/member-network-repository';
export { OpportunityProgressNotifier } from './domain/events/opportunity-progress-observer';
export type { OpportunityProgressObserver } from './domain/events/opportunity-progress-observer';
