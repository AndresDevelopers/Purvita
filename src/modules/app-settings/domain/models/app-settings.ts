import { z } from 'zod';

export const LevelCapacitySchema = z.object({
  level: z.number().int().min(1).max(10),
  maxMembers: z.number().int().min(0),
});

export const AppSettingsSchema = z.object({
  id: z.string(),
  maxMembersPerLevel: z.array(LevelCapacitySchema),
  payoutFrequency: z.enum(['weekly', 'biweekly', 'monthly']),
  currency: z.string().length(3),
  currencies: z
    .array(
      z.object({
        code: z
          .string()
          .length(3)
          .transform((value) => value.toUpperCase()),
        countryCodes: z
          .array(
            z
              .string()
              .length(2)
              .transform((value) => value.toUpperCase()),
          )
          .default([]),
      }),
    )
    .default([]),
  autoAdvanceEnabled: z.boolean(),
  ecommerceCommissionRate: z.number().min(0).max(1).default(0.08),
  teamLevelsVisible: z.number().int().min(1).max(10).default(2),
  storeOwnerDiscountType: z.enum(['fixed', 'percent']).default('fixed'),
  storeOwnerDiscountValue: z.number().min(0).default(0),
  directSponsorCommissionRate: z.number().min(0).max(1).default(0),
  networkCommissionRate: z.number().min(0).max(1).default(0),
  rewardCreditLabelEn: z.string().default('Reward Credits'),
  rewardCreditLabelEs: z.string().default('Créditos de Recompensa'),
  freeProductLabelEn: z.string().default('Free Product Value'),
  freeProductLabelEs: z.string().default('Valor de Producto Gratis'),
  affiliateCommissionRate: z.number().min(0).max(1).default(0.10),
  affiliateDirectSponsorCommissionRate: z.number().min(0).max(1).default(0.05),
  affiliateGeneralSponsorCommissionRate: z.number().min(0).max(1).default(0.02),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const AppSettingsUpdateSchema = AppSettingsSchema.pick({
  maxMembersPerLevel: true,
  payoutFrequency: true,
  currency: true,
  currencies: true,
  autoAdvanceEnabled: true,
  ecommerceCommissionRate: true,
  teamLevelsVisible: true,
  storeOwnerDiscountType: true,
  storeOwnerDiscountValue: true,
  directSponsorCommissionRate: true,
  networkCommissionRate: true,
  rewardCreditLabelEn: true,
  rewardCreditLabelEs: true,
  freeProductLabelEn: true,
  freeProductLabelEs: true,
  affiliateCommissionRate: true,
  affiliateDirectSponsorCommissionRate: true,
  affiliateGeneralSponsorCommissionRate: true,
}).superRefine((data, ctx) => {
  const seenCodes = new Set<string>();
  const seenCountries = new Set<string>();
  let hasGlobalCurrency = false;
  const baseCurrencyCode = data.currency.toUpperCase();
  let baseCurrencyPresent = false;

  data.currencies.forEach((entry, entryIndex) => {
    const normalizedCode = entry.code.toUpperCase();

    if (seenCodes.has(normalizedCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currencies', entryIndex, 'code'],
        message: 'Currency codes must be unique.',
      });
    } else {
      seenCodes.add(normalizedCode);
    }

    if (normalizedCode === baseCurrencyCode) {
      baseCurrencyPresent = true;
    }

    if (entry.countryCodes.length === 0) {
      if (hasGlobalCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currencies', entryIndex, 'countryCodes'],
          message: 'Only one currency can target all remaining countries.',
        });
      }
      hasGlobalCurrency = true;
    }

    const localCountries = new Set<string>();
    entry.countryCodes.forEach((countryCode, countryIndex) => {
      const normalizedCountry = countryCode.toUpperCase();
      if (localCountries.has(normalizedCountry)) {
        return;
      }
      localCountries.add(normalizedCountry);

      if (seenCountries.has(normalizedCountry)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currencies', entryIndex, 'countryCodes', countryIndex],
          message: 'Each country can only be assigned to one currency.',
        });
      } else {
        seenCountries.add(normalizedCountry);
      }
    });
  });

  if (!hasGlobalCurrency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currencies'],
      message: 'Enable the "All countries" option for at least one currency to cover every remaining country.',
    });
  }

  if (!baseCurrencyPresent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currencies'],
      message: 'Include the default currency in the visibility mappings.',
    });
  }
});

export type AppSettingsUpdateInput = z.infer<typeof AppSettingsUpdateSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'global',
  maxMembersPerLevel: [
    { level: 1, maxMembers: 5 },
    { level: 2, maxMembers: 25 },
    { level: 3, maxMembers: 125 },
    { level: 4, maxMembers: 625 },
    { level: 5, maxMembers: 3125 },
  ],
  payoutFrequency: 'monthly',
  currency: 'USD',
  currencies: [
    {
      code: 'USD',
      countryCodes: [],
    },
  ],
  autoAdvanceEnabled: true,
  ecommerceCommissionRate: 0.08,
  teamLevelsVisible: 2,
  storeOwnerDiscountType: 'fixed',
  storeOwnerDiscountValue: 0,
  directSponsorCommissionRate: 0,
  networkCommissionRate: 0,
  rewardCreditLabelEn: 'Reward Credits',
  rewardCreditLabelEs: 'Créditos de Recompensa',
  freeProductLabelEn: 'Free Product Value',
  freeProductLabelEs: 'Valor de Producto Gratis',
  affiliateCommissionRate: 0.10,
  affiliateDirectSponsorCommissionRate: 0.05,
  affiliateGeneralSponsorCommissionRate: 0.02,
  createdAt: null,
  updatedAt: null,
};
