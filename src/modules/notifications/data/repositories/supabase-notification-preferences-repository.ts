import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationPreferencesRepository } from '../../domain/contracts/notification-preferences-repository';
import {
  NotificationPreferencesSchema,
  type NotificationPreferences,
  type NotificationPreferencesUpdate,
  type NotificationPreferencesCreate,
} from '../../domain/models/notification-preferences';

type DbNotificationPreferencesRow = {
  user_id: string;
  promotional_offers: boolean;
  team_updates: boolean;
  new_video_content: boolean;
  order_notifications: boolean;
  subscription_notifications: boolean;
  created_at: string;
  updated_at: string;
};

const COLUMNS = 'user_id, promotional_offers, team_updates, new_video_content, order_notifications, subscription_notifications, created_at, updated_at';

function mapFromDb(row: DbNotificationPreferencesRow): NotificationPreferences {
  return NotificationPreferencesSchema.parse({
    userId: row.user_id,
    promotionalOffers: row.promotional_offers,
    teamUpdates: row.team_updates,
    newVideoContent: row.new_video_content,
    orderNotifications: row.order_notifications,
    subscriptionNotifications: row.subscription_notifications,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapToDb(preferences: Partial<NotificationPreferencesUpdate>): Partial<DbNotificationPreferencesRow> {
  const result: Partial<DbNotificationPreferencesRow> = {};

  if (preferences.promotionalOffers !== undefined) {
    result.promotional_offers = preferences.promotionalOffers;
  }
  if (preferences.teamUpdates !== undefined) {
    result.team_updates = preferences.teamUpdates;
  }
  if (preferences.newVideoContent !== undefined) {
    result.new_video_content = preferences.newVideoContent;
  }
  if (preferences.orderNotifications !== undefined) {
    result.order_notifications = preferences.orderNotifications;
  }
  if (preferences.subscriptionNotifications !== undefined) {
    result.subscription_notifications = preferences.subscriptionNotifications;
  }

  return result;
}

export class SupabaseNotificationPreferencesRepository implements NotificationPreferencesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await this.client
      .from('notification_preferences')
      .select(COLUMNS)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch notification preferences: ${error.message}`);
    }

    return mapFromDb(data);
  }

  async create(preferences: NotificationPreferencesCreate): Promise<NotificationPreferences> {
    const { data, error } = await this.client
      .from('notification_preferences')
      .insert({
        user_id: preferences.userId,
        promotional_offers: preferences.promotionalOffers,
        team_updates: preferences.teamUpdates,
        new_video_content: preferences.newVideoContent,
        order_notifications: preferences.orderNotifications,
        subscription_notifications: preferences.subscriptionNotifications,
      })
      .select(COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to create notification preferences: ${error.message}`);
    }

    return mapFromDb(data);
  }

  async upsert(userId: string, preferences: NotificationPreferencesUpdate): Promise<NotificationPreferences> {
    // First, try to get existing preferences
    const existing = await this.findByUserId(userId);

    if (existing) {
      // Update existing preferences
      const dbPreferences = mapToDb(preferences);

      const { data, error } = await this.client
        .from('notification_preferences')
        .update(dbPreferences)
        .eq('user_id', userId)
        .select(COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update notification preferences: ${error.message}`);
      }

      return mapFromDb(data);
    } else {
      // Create new preferences with defaults for missing fields
      const createData: NotificationPreferencesCreate = {
        userId,
        promotionalOffers: preferences.promotionalOffers ?? true,
        teamUpdates: preferences.teamUpdates ?? true,
        newVideoContent: preferences.newVideoContent ?? false,
        orderNotifications: preferences.orderNotifications ?? true,
        subscriptionNotifications: preferences.subscriptionNotifications ?? true,
      };

      return this.create(createData);
    }
  }

  async findUsersWithPreference(
    preference: 'promotionalOffers' | 'teamUpdates' | 'newVideoContent' | 'orderNotifications'
  ): Promise<NotificationPreferences[]> {
    const columnMap = {
      promotionalOffers: 'promotional_offers',
      teamUpdates: 'team_updates',
      newVideoContent: 'new_video_content',
      orderNotifications: 'order_notifications',
    };

    const column = columnMap[preference];

    const { data, error } = await this.client
      .from('notification_preferences')
      .select(COLUMNS)
      .eq(column, true);

    if (error) {
      throw new Error(`Failed to fetch users with preference ${preference}: ${error.message}`);
    }

    return data.map(mapFromDb);
  }
}

