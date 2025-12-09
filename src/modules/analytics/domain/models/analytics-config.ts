import { z } from 'zod';

/**
 * Analytics Configuration Schema
 * Controls analytics features and access
 */
export const AnalyticsConfigSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),

  // Feature flags
  analytics_enabled: z.boolean().default(true),
  advanced_analytics_enabled: z.boolean().default(false),

  // Privacy settings
  tracking_consent: z.boolean().default(false),
  anonymize_ip: z.boolean().default(true),
  data_retention_days: z.number().default(90),

  // Notification settings
  weekly_report_enabled: z.boolean().default(false),
  monthly_report_enabled: z.boolean().default(false),

  // Timestamps
  created_at: z.string().datetime().or(z.date()).optional(),
  updated_at: z.string().datetime().or(z.date()).optional()
});

export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>;

/**
 * Analytics Config Update Schema
 */
export const AnalyticsConfigUpdateSchema = AnalyticsConfigSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true
}).partial();

export type AnalyticsConfigUpdate = z.infer<typeof AnalyticsConfigUpdateSchema>;

/**
 * Privacy Consent Schema
 */
export const PrivacyConsentSchema = z.object({
  tracking_consent: z.boolean(),
  anonymize_ip: z.boolean().optional(),
  timestamp: z.string().datetime().or(z.date()).optional()
});

export type PrivacyConsent = z.infer<typeof PrivacyConsentSchema>;
