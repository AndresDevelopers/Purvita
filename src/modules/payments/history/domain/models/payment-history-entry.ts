import { z } from 'zod';

export const PaymentStatusSchema = z.enum(['paid', 'pending', 'overdue', 'upcoming']);

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

// Legacy payment methods for backward compatibility
export const PaymentMethodSchema = z.enum(['card', 'bank_transfer', 'cash', 'wallet', 'stripe', 'paypal']);

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentHistoryEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string().email(),
  amountCents: z.number()
    .int('Amount must be an integer')
    .nonnegative('Amount must be non-negative')
    .min(50, 'Minimum amount is $0.50 (50 cents)')
    .max(10000000, 'Maximum amount is $100,000 (10,000,000 cents)'),
  currency: z.string().min(3).max(3),
  status: PaymentStatusSchema,
  dueDate: z.string(),
  paidAt: z.string().nullable(),
  nextDueDate: z.string().nullable(),
  method: PaymentMethodSchema,
  manual: z.boolean().default(false),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export type PaymentHistoryEntry = z.infer<typeof PaymentHistoryEntrySchema>;

export const ManualPaymentInputSchema = PaymentHistoryEntrySchema.pick({
  userId: true,
  userName: true,
  userEmail: true,
  amountCents: true,
  currency: true,
  method: true,
  notes: true,
}).extend({
  paidAt: z.string().optional(),
});

export type ManualPaymentInput = z.infer<typeof ManualPaymentInputSchema>;

export const PaymentHistoryFilterSchema = z.object({
  status: PaymentStatusSchema.optional(),
});

export type PaymentHistoryFilter = z.infer<typeof PaymentHistoryFilterSchema>;
