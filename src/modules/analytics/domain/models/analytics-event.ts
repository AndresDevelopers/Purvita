import { z } from 'zod';

/**
 * Analytics Event Types
 * Standard e-commerce events for comprehensive tracking
 */
export const AnalyticsEventType = z.enum([
  'pageview',           // Page view
  'product_view',       // Product detail view
  'add_to_cart',        // Add item to cart
  'remove_from_cart',   // Remove item from cart
  'begin_checkout',     // Checkout process started
  'add_payment_info',   // Payment info added
  'purchase',           // Purchase completed
  'search',             // Search performed
  'view_cart',          // Cart viewed
  'view_item_list',     // Product list viewed
  'select_item',        // Item selected from list
  'user_signup',        // User registered
  'user_login',         // User logged in
  'share',              // Content shared
  'custom'              // Custom event
]);

export type AnalyticsEventType = z.infer<typeof AnalyticsEventType>;

/**
 * Product Item Schema
 * Represents a product in analytics events
 */
export const AnalyticsProductItem = z.object({
  item_id: z.string(),
  item_name: z.string(),
  item_category: z.string().optional(),
  item_category2: z.string().optional(),
  item_brand: z.string().optional(),
  price: z.number(),
  quantity: z.number().default(1),
  currency: z.string().default('USD'),
  discount: z.number().optional(),
  item_variant: z.string().optional(),
  index: z.number().optional()
});

export type AnalyticsProductItem = z.infer<typeof AnalyticsProductItem>;

/**
 * Event Parameters Schema
 * Rich parameters for analytics events
 */
export const AnalyticsEventParams = z.object({
  // Page parameters
  page_path: z.string().optional(),
  page_title: z.string().optional(),
  page_location: z.string().optional(),

  // User parameters
  user_id: z.string().optional(),
  user_type: z.enum(['guest', 'member', 'admin']).optional(),

  // Product parameters
  items: z.array(AnalyticsProductItem).optional(),

  // Transaction parameters
  transaction_id: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
  tax: z.number().optional(),
  shipping: z.number().optional(),
  coupon: z.string().optional(),
  payment_method: z.string().optional(),

  // Search parameters
  search_term: z.string().optional(),

  // Custom parameters
  custom_data: z.record(z.any()).optional()
});

export type AnalyticsEventParams = z.infer<typeof AnalyticsEventParams>;

/**
 * Analytics Event Schema
 * Complete event structure for tracking
 */
export const AnalyticsEventSchema = z.object({
  id: z.string().uuid().optional(),
  event_type: AnalyticsEventType,
  event_name: z.string().optional(), // Custom event name
  params: AnalyticsEventParams,

  // User context
  user_id: z.string().uuid().nullable(),
  session_id: z.string(),

  // Technical context
  user_agent: z.string().optional(),
  ip_address: z.string().optional(),
  referrer: z.string().optional(),

  // Timestamp
  timestamp: z.string().datetime().or(z.date()).optional(),
  created_at: z.string().datetime().or(z.date()).optional()
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

/**
 * Analytics Event Input Schema
 * For creating new events
 */
export const AnalyticsEventInputSchema = AnalyticsEventSchema.omit({
  id: true,
  created_at: true
});

export type AnalyticsEventInput = z.infer<typeof AnalyticsEventInputSchema>;
