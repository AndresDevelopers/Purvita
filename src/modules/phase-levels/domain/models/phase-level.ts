import { z } from 'zod';

export const PhaseLevelSchema = z.object({
  id: z.string().uuid(),
  level: z.number().int().min(0).max(10),
  name: z.string().min(1),
  nameEn: z.string().nullable().optional(),
  nameEs: z.string().nullable().optional(),
  commissionRate: z.number().min(0).max(1),
  subscriptionDiscountRate: z.number().min(0).max(1).default(0),
  affiliateSponsorCommissionRate: z.number().min(0).max(1).default(0),
  creditCents: z.number().int().min(0),
  freeProductValueCents: z.number().int().min(0).default(0),
  isActive: z.boolean(),
  displayOrder: z.number().int(),
  descriptorEn: z.string().nullable().optional(),
  descriptorEs: z.string().nullable().optional(),
  requirementEn: z.string().nullable().optional(),
  requirementEs: z.string().nullable().optional(),
  rewardsEn: z.array(z.string()).nullable().optional(),
  rewardsEs: z.array(z.string()).nullable().optional(),
  visibilityTagEn: z.string().nullable().optional(),
  visibilityTagEs: z.string().nullable().optional(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type PhaseLevel = z.infer<typeof PhaseLevelSchema>;

export const PhaseLevelCreateSchema = PhaseLevelSchema.pick({
  level: true,
  name: true,
  nameEn: true,
  nameEs: true,
  commissionRate: true,
  subscriptionDiscountRate: true,
  affiliateSponsorCommissionRate: true,
  creditCents: true,
  freeProductValueCents: true,
  isActive: true,
  displayOrder: true,
});

export type PhaseLevelCreateInput = z.infer<typeof PhaseLevelCreateSchema>;

export const PhaseLevelUpdateSchema = PhaseLevelSchema.pick({
  name: true,
  nameEn: true,
  nameEs: true,
  commissionRate: true,
  subscriptionDiscountRate: true,
  affiliateSponsorCommissionRate: true,
  creditCents: true,
  freeProductValueCents: true,
  isActive: true,
  displayOrder: true,
}).partial();

export type PhaseLevelUpdateInput = z.infer<typeof PhaseLevelUpdateSchema>;

export const DEFAULT_PHASE_LEVELS: Omit<PhaseLevel, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    level: 0,
    name: 'Registration',
    nameEn: 'Registration',
    nameEs: 'Registro',
    commissionRate: 0.08,
    subscriptionDiscountRate: 0,
    affiliateSponsorCommissionRate: 0,
    creditCents: 0,
    freeProductValueCents: 6500,
    isActive: true,
    displayOrder: 0,
  },
  {
    level: 1,
    name: 'First Partners',
    nameEn: 'First Partners',
    nameEs: 'Primeros Socios',
    commissionRate: 0.15,
    subscriptionDiscountRate: 0,
    affiliateSponsorCommissionRate: 0,
    creditCents: 0,
    freeProductValueCents: 6500,
    isActive: true,
    displayOrder: 1,
  },
  {
    level: 2,
    name: 'Duplicate Team',
    nameEn: 'Duplicate Team',
    nameEs: 'Equipo Duplicado',
    commissionRate: 0.30,
    subscriptionDiscountRate: 0,
    affiliateSponsorCommissionRate: 0,
    creditCents: 12500,
    freeProductValueCents: 0,
    isActive: true,
    displayOrder: 2,
  },
  {
    level: 3,
    name: 'Network Momentum',
    nameEn: 'Network Momentum',
    nameEs: 'Impulso de Red',
    commissionRate: 0.40,
    subscriptionDiscountRate: 0,
    affiliateSponsorCommissionRate: 0,
    creditCents: 24000,
    freeProductValueCents: 0,
    isActive: true,
    displayOrder: 3,
  },
];
