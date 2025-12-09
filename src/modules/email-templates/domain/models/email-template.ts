import { z } from 'zod';

/**
 * Email template from database
 */
export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  subjectEn: string;
  subjectEs: string;
  bodyEn: string;
  bodyEs: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Processed email template ready to send
 */
export interface ProcessedEmailTemplate {
  subject: string;
  body: string;
  html: string;
}

/**
 * Variables to replace in template
 */
export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

/**
 * Locale for template selection
 */
export type TemplateLocale = 'en' | 'es';

/**
 * Email template IDs (must match database)
 */
export const EMAIL_TEMPLATE_IDS = {
  PROMOTIONAL_OFFERS: 'promotional_offers',
  TEAM_MEMBER_ADDED: 'team_member_added',
  NEW_VIDEO_CONTENT: 'new_video_content',
  ORDER_CONFIRMATION: 'order_confirmation',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REFUNDED: 'payment_refunded',
} as const;

export type EmailTemplateId = typeof EMAIL_TEMPLATE_IDS[keyof typeof EMAIL_TEMPLATE_IDS];

/**
 * Zod schema for email template
 */
export const EmailTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  subjectEn: z.string(),
  subjectEs: z.string(),
  bodyEn: z.string(),
  bodyEs: z.string(),
  variables: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

