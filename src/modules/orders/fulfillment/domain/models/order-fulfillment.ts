import { z } from 'zod';

export const ORDER_STATUSES = ['draft', 'pending', 'paid', 'failed', 'canceled', 'refunded'] as const;

export const OrderFulfillmentItemSchema = z.object({
  itemId: z.string(),
  productId: z.string().nullable(),
  productName: z.string().nullable(),
  quantity: z.number().nonnegative(),
  unitPriceCents: z.number().nonnegative(),
  lineTotalCents: z.number().nonnegative(),
});

export const OrderFulfillmentCustomerSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
});

export const OrderFulfillmentOrderSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  createdAt: z.string(),
  currency: z.string(),
  totalCents: z.number().nonnegative(),
  taxCents: z.number().nonnegative(),
  shippingCents: z.number().nonnegative(),
  discountCents: z.number().nonnegative(),
  purchaseSource: z.enum(['main_store', 'affiliate_store']).default('main_store'),
  customer: OrderFulfillmentCustomerSchema,
  items: z.array(OrderFulfillmentItemSchema),
});

export const OrderFulfillmentSummarySchema = z.object({
  totalOrders: z.number().nonnegative(),
  totalUnits: z.number().nonnegative(),
  totalRevenueCents: z.number().nonnegative(),
  totalShippingCents: z.number().nonnegative(),
  totalTaxCents: z.number().nonnegative(),
  totalDiscountCents: z.number().nonnegative(),
});

export const OrderFulfillmentSnapshotSchema = z.object({
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  timezone: z.string(),
  generatedAt: z.string(),
  summary: OrderFulfillmentSummarySchema,
  orders: z.array(OrderFulfillmentOrderSchema),
});

export const OrderFulfillmentRequestSchema = z.object({
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
});

export type OrderFulfillmentItem = z.infer<typeof OrderFulfillmentItemSchema>;
export type OrderFulfillmentCustomer = z.infer<typeof OrderFulfillmentCustomerSchema>;
export type OrderFulfillmentOrder = z.infer<typeof OrderFulfillmentOrderSchema>;
export type OrderFulfillmentSummary = z.infer<typeof OrderFulfillmentSummarySchema>;
export type OrderFulfillmentSnapshot = z.infer<typeof OrderFulfillmentSnapshotSchema>;
export type OrderFulfillmentRequest = z.infer<typeof OrderFulfillmentRequestSchema>;
