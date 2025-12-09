import { z } from 'zod';

export const NotificationPreferencesSchema = z.object({
  userId: z.string().uuid(),
  promotionalOffers: z.boolean(),
  teamUpdates: z.boolean(),
  newVideoContent: z.boolean(),
  orderNotifications: z.boolean(),
  subscriptionNotifications: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const NotificationPreferencesUpdateSchema = z.object({
  promotionalOffers: z.boolean().optional(),
  teamUpdates: z.boolean().optional(),
  newVideoContent: z.boolean().optional(),
  orderNotifications: z.boolean().optional(),
  subscriptionNotifications: z.boolean().optional(),
});

export const NotificationPreferencesCreateSchema = z.object({
  userId: z.string().uuid(),
  promotionalOffers: z.boolean().default(true),
  teamUpdates: z.boolean().default(true),
  newVideoContent: z.boolean().default(false),
  orderNotifications: z.boolean().default(true),
  subscriptionNotifications: z.boolean().default(true),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type NotificationPreferencesUpdate = z.infer<typeof NotificationPreferencesUpdateSchema>;
export type NotificationPreferencesCreate = z.infer<typeof NotificationPreferencesCreateSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'> = {
  promotionalOffers: true,
  teamUpdates: true,
  newVideoContent: false,
  orderNotifications: true,
  subscriptionNotifications: true,
};

