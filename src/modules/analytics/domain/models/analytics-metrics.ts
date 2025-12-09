import { z } from 'zod';

/**
 * Time Period for Metrics
 */
export const MetricsPeriod = z.enum([
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'this_month',
  'last_month',
  'custom'
]);

export type MetricsPeriod = z.infer<typeof MetricsPeriod>;

/**
 * Basic Metrics Schema
 * Core metrics visible to all users
 */
export const BasicMetricsSchema = z.object({
  // Traffic metrics
  total_visits: z.number(),
  unique_visitors: z.number(),
  page_views: z.number(),
  avg_session_duration: z.number().optional(),
  bounce_rate: z.number().optional(),

  // E-commerce metrics
  total_orders: z.number(),
  total_revenue: z.number(),
  avg_order_value: z.number(),
  conversion_rate: z.number(),

  // Product metrics
  top_products: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    views: z.number(),
    add_to_cart: z.number(),
    purchases: z.number(),
    revenue: z.number()
  })).max(5),

  // Period info
  period: MetricsPeriod,
  start_date: z.string().datetime().or(z.date()),
  end_date: z.string().datetime().or(z.date())
});

export type BasicMetrics = z.infer<typeof BasicMetricsSchema>;

/**
 * Advanced Metrics Schema
 * Advanced analytics for premium users
 */
export const AdvancedMetricsSchema = z.object({
  // Funnel analysis
  funnel: z.object({
    product_views: z.number(),
    add_to_cart: z.number(),
    begin_checkout: z.number(),
    add_payment_info: z.number(),
    purchase: z.number(),

    // Conversion rates
    cart_conversion: z.number(),
    checkout_conversion: z.number(),
    payment_conversion: z.number(),
    overall_conversion: z.number()
  }).optional(),

  // Cohort analysis
  cohorts: z.array(z.object({
    cohort_date: z.string(),
    users: z.number(),
    retention: z.record(z.number()) // day -> retention %
  })).optional(),

  // Customer Lifetime Value
  clv: z.object({
    avg_customer_value: z.number(),
    avg_purchase_frequency: z.number(),
    avg_customer_lifespan: z.number(),
    clv: z.number()
  }).optional(),

  // Traffic sources
  traffic_sources: z.array(z.object({
    source: z.string(),
    medium: z.string().optional(),
    users: z.number(),
    sessions: z.number(),
    conversion_rate: z.number(),
    revenue: z.number()
  })).optional(),

  // Geographic data
  geographic: z.array(z.object({
    country: z.string(),
    users: z.number(),
    revenue: z.number()
  })).optional(),

  // Device breakdown
  devices: z.object({
    desktop: z.number(),
    mobile: z.number(),
    tablet: z.number()
  }).optional(),

  // Time series data
  time_series: z.array(z.object({
    date: z.string(),
    visits: z.number(),
    revenue: z.number(),
    orders: z.number()
  })).optional()
});

export type AdvancedMetrics = z.infer<typeof AdvancedMetricsSchema>;

/**
 * Combined Metrics Response
 */
export const AnalyticsMetricsSchema = z.object({
  basic: BasicMetricsSchema,
  advanced: AdvancedMetricsSchema.optional()
});

export type AnalyticsMetrics = z.infer<typeof AnalyticsMetricsSchema>;

/**
 * Metrics Query Parameters
 */
export const MetricsQuerySchema = z.object({
  period: MetricsPeriod,
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  include_advanced: z.boolean().default(false)
});

export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;
