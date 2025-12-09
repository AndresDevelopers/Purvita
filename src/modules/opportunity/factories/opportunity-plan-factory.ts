import {
  OpportunityPlanSchema,
  type OpportunityPlan,
} from '../domain/models/opportunity-plan';

export class OpportunityPlanFactory {
  static createFromConfig(config: unknown): OpportunityPlan {
    return OpportunityPlanSchema.parse(config);
  }
}
