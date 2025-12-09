import { OpportunityPlanFactory } from '../factories/opportunity-plan-factory';

/**
 * Get the monthly fee amount from the active plan in the database.
 * This function should be called to get the current subscription price.
 * Falls back to 34 if no plan is found.
 */
async function _getMonthlyFeeFromPlan(): Promise<number> {
  try {
    const { getPlans } = await import('@/lib/services/plan-service');
    const plans = await getPlans();
    if (plans.length > 0) {
      const lowestPricePlan = plans.reduce((min, plan) => (plan.price < min.price ? plan : min), plans[0]);
      return lowestPricePlan.price;
    }
  } catch (error) {
    console.warn('Failed to fetch plan price, using default:', error);
  }
  return 34; // Fallback default
}

const rawPlanConfig = {
  id: 'purvita-default',
  name: 'PurVita Core Opportunity Plan',
  monthlyFee: {
    amount: 34, // This is the default fallback. The actual price comes from the database plans table.
    currency: 'USD',
  },
  maxNetworkSize: 1000,
  payoutCurrency: 'USD',
  supportedProviders: ['paypal', 'stripe', 'wallet'],
  phases: [
    {
      id: 'phase0',
      name: 'Phase 0 · Registration',
      visibility: 'visible',
      requirement: {
        type: 'subscriptionActive',
        minimumConsecutiveMonths: 1,
      },
      description:
        'Complete your registration and activate your membership with the monthly subscription to access the business toolkit.',
      rewards: [
        { label: 'Business orientation resources', type: 'enablement' },
        { label: 'Personal affiliate link', type: 'enablement' },
        { label: 'Recruitment video training', type: 'enablement' },
        { label: 'E-commerce access to start selling', type: 'enablement' },
      ],
      ecommerceCommissionRate: 0.08,
    },
    {
      id: 'phase1',
      name: 'Phase 1 · First Partners',
      visibility: 'visible',
      requirement: {
        type: 'directActiveRecruits',
        requiredActive: 2,
        requirePaidInvoiceThisCycle: true,
      },
      description:
        'Recruit two partners who each activate their subscription to unlock your first reward tier.',
      rewards: [
        { label: 'Free product credit', type: 'productCredit', amount: 65, currency: 'USD' },
        { label: 'Wallet balance credit', type: 'walletBalance', amount: 3, currency: 'USD' },
      ],
      ecommerceCommissionRate: 0.15,
    },
    {
      id: 'phase2',
      name: 'Phase 2 · Duplicate Your Team',
      visibility: 'visible',
      requirement: {
        type: 'secondLevelActiveRecruits',
        requiredActive: 4,
        minimumPerDirect: 2,
      },
      description:
        'Coach your two partners so each recruits two members. Maintain four active subscriptions across your second level.',
      rewards: [
        { label: 'Free products credit', type: 'productCredit', amount: 125, currency: 'USD' },
        { label: 'Wallet balance credit', type: 'walletBalance', amount: 9, currency: 'USD' },
      ],
      ecommerceCommissionRate: 0.3,
    },
    {
      id: 'phase3',
      name: 'Phase 3 · Network Momentum',
      visibility: 'visible',
      requirement: {
        type: 'networkRetention',
        requiredLevels: 2,
        requireAllActive: true,
      },
      description:
        'Maintain network momentum with active subscriptions across your first and second levels for an entire billing cycle.',
      rewards: [
        { label: 'Free products credit', type: 'productCredit', amount: 240, currency: 'USD' },
        { label: 'Wallet balance credit', type: 'walletBalance', amount: 506, currency: 'USD' },
      ],
      ecommerceCommissionRate: 0.4,
    },
  ],
};

export const DefaultOpportunityPlan = OpportunityPlanFactory.createFromConfig(rawPlanConfig);
