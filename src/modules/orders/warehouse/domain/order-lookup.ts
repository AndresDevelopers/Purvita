import { z } from 'zod';

export const WarehouseOrderSummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  status: z.string(),
  totalCents: z.number().nonnegative(),
  createdAt: z.string(),
  customerName: z.string().nullable(),
  customerEmail: z.string().nullable(),
});

export type WarehouseOrderSummary = z.infer<typeof WarehouseOrderSummarySchema>;

export const WarehouseOrderLookupResponseSchema = z.object({
  orders: WarehouseOrderSummarySchema.array(),
});

export type WarehouseOrderLookupResponse = z.infer<typeof WarehouseOrderLookupResponseSchema>;
