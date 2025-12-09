import { z } from 'zod';

export const AdminBroadcastAudienceTypeSchema = z.enum([
  'all_users',
  'active_subscribers',
  'lapsed_subscribers',
  'product_purchasers',
  'specific_user',
]);

export type AdminBroadcastAudienceType = z.infer<typeof AdminBroadcastAudienceTypeSchema>;

export const AdminBroadcastAudienceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('all_users'),
  }),
  z.object({
    type: z.literal('active_subscribers'),
  }),
  z.object({
    type: z.literal('lapsed_subscribers'),
  }),
  z.object({
    type: z.literal('product_purchasers'),
    productId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('specific_user'),
    userId: z.string().uuid(),
  }),
]);

export type AdminBroadcastAudience = z.infer<typeof AdminBroadcastAudienceSchema>;

export const AdminBroadcastMessageSchema = z.object({
  subject: z
    .string()
    .min(3, 'Subject must include at least 3 characters')
    .max(160, 'Subject must be shorter than 160 characters.'),
  body: z
    .string()
    .min(20, 'Message body must be at least 20 characters long.')
    .max(6000, 'Message body cannot exceed 6000 characters.'),
});

export const AdminBroadcastPreviewRequestSchema = z.intersection(
  AdminBroadcastAudienceSchema,
  z.object({
    previewOnly: z.literal(true).optional(),
  }),
);

export const AdminBroadcastSendRequestSchema = z.intersection(
  AdminBroadcastAudienceSchema,
  z.object({
    subject: AdminBroadcastMessageSchema.shape.subject,
    body: AdminBroadcastMessageSchema.shape.body,
  }),
);

export type AdminBroadcastSendRequest = z.infer<typeof AdminBroadcastSendRequestSchema>;

export interface BroadcastRecipient {
  id: string | null;
  email: string;
  name: string | null;
}

export interface AdminBroadcastSnapshot {
  counts: {
    allUsers: number;
    activeSubscribers: number;
    lapsedSubscribers: number;
  };
  products: Array<{ id: string; name: string }>;
  generatedAt: string;
}

export interface AdminBroadcastOverview extends AdminBroadcastSnapshot {
  environment: {
    hasEmailProvider: boolean;
    fromNameConfigured: boolean;
    fromEmailConfigured: boolean;
  };
}

export interface AdminBroadcastResult {
  intendedCount: number;
  deliveredCount: number;
  failedCount: number;
  failures: Array<{ email: string; reason: string }>;
  broadcastId: string;
}

export interface AdminBroadcastRecordInput {
  request: AdminBroadcastSendRequest;
  senderId: string;
  senderEmail: string | null;
  recipients: BroadcastRecipient[];
  failures: Array<{ recipient: BroadcastRecipient; error: Error }>;
}

