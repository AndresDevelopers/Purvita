import { z } from 'zod';

export const WAREHOUSE_TRACKING_STATUSES = [
  'pending',
  'packed',
  'in_transit',
  'delivered',
  'delayed',
  'canceled',
] as const;

export const WarehouseTrackingStatusSchema = z.enum(WAREHOUSE_TRACKING_STATUSES);

export const WarehouseTrackingEventSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  orderCode: z.string().nullable(),
  status: WarehouseTrackingStatusSchema,
  responsibleCompany: z.string().nullable(),
  trackingCode: z.string().nullable(),
  location: z.string().nullable(),
  note: z.string().nullable(),
  estimatedDelivery: z.string().nullable(),
  eventTime: z.string(),
  createdAt: z.string(),
  customerName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  orderStatus: z.string(),
});

export type WarehouseTrackingEvent = z.infer<typeof WarehouseTrackingEventSchema>;

export const WarehouseTrackingResponseSchema = z.object({
  entries: WarehouseTrackingEventSchema.array(),
  nextCursor: z.string().nullable(),
});

export type WarehouseTrackingResponse = z.infer<typeof WarehouseTrackingResponseSchema>;

const isoLikeDateTime = z
  .string()
  .refine((value) => {
    if (!value) return false;
    return !Number.isNaN(Date.parse(value));
  }, 'Invalid date');

export const WarehouseTrackingCreateInputSchema = z.object({
  orderId: z.string().uuid(),
  status: WarehouseTrackingStatusSchema,
  responsibleCompany: z.string().trim().min(1).max(120).nullable().optional(),
  trackingCode: z.string().trim().min(1).max(120).nullable().optional(),
  location: z.string().trim().min(1).max(180).nullable().optional(),
  note: z.string().trim().min(1).max(500).nullable().optional(),
  estimatedDelivery: isoLikeDateTime.nullable().optional(),
  eventTime: isoLikeDateTime.nullable().optional(),
});

export type WarehouseTrackingCreateInput = z.infer<typeof WarehouseTrackingCreateInputSchema>;

export const WarehouseTrackingUpdateInputSchema = z.object({
  status: WarehouseTrackingStatusSchema.optional(),
  responsibleCompany: z.string().trim().min(1).max(120).nullable().optional(),
  trackingCode: z.string().trim().min(1).max(120).nullable().optional(),
  location: z.string().trim().min(1).max(180).nullable().optional(),
  note: z.string().trim().min(1).max(500).nullable().optional(),
  estimatedDelivery: isoLikeDateTime.nullable().optional(),
  eventTime: isoLikeDateTime.nullable().optional(),
});

export type WarehouseTrackingUpdateInput = z.infer<typeof WarehouseTrackingUpdateInputSchema>;

export const WarehouseTrackingDictionarySchema = z.object({
  title: z.string(),
  description: z.string(),
  empty: z.object({
    title: z.string(),
    description: z.string(),
  }),
  error: z.object({
    title: z.string(),
    description: z.string(),
    retry: z.string(),
  }),
  form: z.object({
    title: z.string(),
    description: z.string(),
    submit: z.string(),
    submitting: z.string(),
    update: z.string(),
    updating: z.string(),
    cancel: z.string(),
    autoTrackingNote: z.string(),
    fields: z.object({
      orderId: z.string(),
      status: z.string(),
      trackingCode: z.string(),
      location: z.string(),
      note: z.string(),
      estimatedDelivery: z.string(),
      responsibleCompany: z.string(),
      eventTime: z.string(),
    }),
    orderLookup: z.object({
      label: z.string(),
      placeholder: z.string(),
      helper: z.string(),
      empty: z.string(),
      loading: z.string(),
      error: z.string(),
      select: z.string(),
      selectedLabel: z.string(),
      change: z.string(),
    }),
  }),
  filters: z.object({
    searchPlaceholder: z.string(),
    statusLabel: z.string(),
    clear: z.string(),
  }),
  timeline: z.object({
    heading: z.string(),
    customer: z.string(),
    email: z.string(),
    updatedAt: z.string(),
    responsibleCompany: z.string(),
    trackingCode: z.string(),
    estimatedDelivery: z.string(),
    location: z.string(),
    note: z.string(),
  }),
  statusBadges: z.record(z.string(), z.string()),
  loadMore: z.string(),
  loading: z.string(),
});

export type WarehouseTrackingDictionary = z.infer<typeof WarehouseTrackingDictionarySchema>;

const FALLBACK_PREFIX = 'TRK';

const generateRandomSegment = () => {
  const runtimeCrypto =
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto
      : null;

  if (runtimeCrypto?.randomUUID) {
    return runtimeCrypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  }

  return Math.random().toString(36).slice(2, 12).toUpperCase();
};

export const generateWarehouseTrackingCode = () => {
  const dateSegment = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSegment = generateRandomSegment();
  return `${FALLBACK_PREFIX}-${dateSegment}-${randomSegment}`;
};
