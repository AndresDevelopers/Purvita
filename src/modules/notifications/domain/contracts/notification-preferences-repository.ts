import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
  NotificationPreferencesCreate,
} from '../models/notification-preferences';

export interface NotificationPreferencesRepository {
  findByUserId(userId: string): Promise<NotificationPreferences | null>;
  upsert(userId: string, preferences: NotificationPreferencesUpdate): Promise<NotificationPreferences>;
  create(preferences: NotificationPreferencesCreate): Promise<NotificationPreferences>;
  findUsersWithPreference(preference: 'promotionalOffers' | 'teamUpdates' | 'newVideoContent'): Promise<NotificationPreferences[]>;
}

