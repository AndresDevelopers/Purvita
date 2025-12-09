import { z } from 'zod';

export const PaymentFrequencySchema = z.enum(['weekly', 'biweekly', 'monthly']);

export type PaymentFrequency = z.infer<typeof PaymentFrequencySchema>;

export const PaymentModeSchema = z.enum(['manual', 'automatic']);

export type PaymentMode = z.infer<typeof PaymentModeSchema>;

export const PaymentScheduleConfigSchema = z.object({
  frequency: PaymentFrequencySchema,
  dayOfMonth: z.number().int().min(1).max(28).nullable(),
  weekday: z.number().int().min(0).max(6).nullable(),
  reminderDaysBefore: z.array(z.number().int().min(0).max(30)).max(3),
  defaultAmountCents: z.number().int().min(0),
  currency: z.string().min(3).max(3),
  paymentMode: PaymentModeSchema,
  updatedAt: z.string(),
});

export type PaymentScheduleConfig = z.infer<typeof PaymentScheduleConfigSchema>;

export const PaymentScheduleUpdateInputSchema = PaymentScheduleConfigSchema.partial({
  updatedAt: true,
}).extend({
  frequency: PaymentFrequencySchema.optional(),
  paymentMode: PaymentModeSchema.optional(),
});

export type PaymentScheduleUpdateInput = z.infer<typeof PaymentScheduleUpdateInputSchema>;
