import { z } from 'zod';
import { PaymentProviderSchema } from '@/modules/payments/domain/models/payment-gateway';

export const PhaseRequirementTypeSchema = z.enum([
  'subscriptionActive',
  'directActiveRecruits',
  'secondLevelActiveRecruits',
  'networkRetention',
]);

export type PhaseRequirementType = z.infer<typeof PhaseRequirementTypeSchema>;

export const SubscriptionRequirementSchema = z.object({
  type: z.literal('subscriptionActive'),
  minimumConsecutiveMonths: z.number().int().min(1).default(1),
});

export type SubscriptionRequirement = z.infer<typeof SubscriptionRequirementSchema>;

export const DirectRecruitRequirementSchema = z.object({
  type: z.literal('directActiveRecruits'),
  requiredActive: z.number().int().min(1),
  requirePaidInvoiceThisCycle: z.boolean().default(true),
});

export type DirectRecruitRequirement = z.infer<typeof DirectRecruitRequirementSchema>;

export const SecondLevelRequirementSchema = z.object({
  type: z.literal('secondLevelActiveRecruits'),
  requiredActive: z.number().int().min(1),
  minimumPerDirect: z.number().int().min(1).default(2),
});

export type SecondLevelRequirement = z.infer<typeof SecondLevelRequirementSchema>;

export const NetworkRetentionRequirementSchema = z.object({
  type: z.literal('networkRetention'),
  requiredLevels: z.number().int().min(1).max(3).default(2),
  requireAllActive: z.boolean().default(true),
});

export type NetworkRetentionRequirement = z.infer<typeof NetworkRetentionRequirementSchema>;

export const PhaseRequirementSchema = z.discriminatedUnion('type', [
  SubscriptionRequirementSchema,
  DirectRecruitRequirementSchema,
  SecondLevelRequirementSchema,
  NetworkRetentionRequirementSchema,
]);

export type PhaseRequirement = z.infer<typeof PhaseRequirementSchema>;

export const OpportunityPhaseRewardSchema = z.object({
  label: z.string(),
  amount: z.number().min(0).nullable().optional(),
  type: z.enum(['productCredit', 'walletBalance', 'commissionRate', 'enablement']).default('enablement'),
  currency: z.string().optional(),
});

export type OpportunityPhaseReward = z.infer<typeof OpportunityPhaseRewardSchema>;

export const OpportunityPhaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  visibility: z.enum(['visible', 'hidden']).default('visible'),
  requirement: PhaseRequirementSchema,
  description: z.string().min(1),
  rewards: z.array(OpportunityPhaseRewardSchema),
  ecommerceCommissionRate: z.number().min(0).max(1),
});

export type OpportunityPhase = z.infer<typeof OpportunityPhaseSchema>;

export const OpportunityPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  monthlyFee: z.object({
    amount: z.number().positive(),
    currency: z.string().min(1),
  }),
  maxNetworkSize: z.number().int().min(1).default(1000),
  payoutCurrency: z.string().min(1).default('USD'),
  supportedProviders: z.array(PaymentProviderSchema).min(1),
  phases: z.array(OpportunityPhaseSchema).min(1),
});

export type OpportunityPlan = z.infer<typeof OpportunityPlanSchema>;

export const PhaseProgressSchema = z.object({
  phaseId: z.string(),
  isUnlocked: z.boolean(),
  unlockedAt: z.string().datetime().nullable(),
});

export type PhaseProgress = z.infer<typeof PhaseProgressSchema>;

export const OpportunityProgressSchema = z.object({
  memberId: z.string().uuid(),
  currentPhaseId: z.string(),
  phaseProgress: z.array(PhaseProgressSchema),
  totalActiveMembers: z.number().int().min(0),
  directActiveMembers: z.number().int().min(0),
  secondLevelActiveMembers: z.number().int().min(0),
  qualifyingProvider: PaymentProviderSchema.nullable(),
});

export type OpportunityProgress = z.infer<typeof OpportunityProgressSchema>;
