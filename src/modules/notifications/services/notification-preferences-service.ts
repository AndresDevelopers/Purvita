import { subscribeToMailchimp, unsubscribeFromMailchimp } from '@/lib/services/mailchimp-service';
import { getUserMarketingData } from '@/lib/helpers/marketing-data-helper';
import type { NotificationPreferencesRepository } from '../domain/contracts/notification-preferences-repository';
import {
  NotificationPreferencesUpdateSchema,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type NotificationPreferencesUpdate,
} from '../domain/models/notification-preferences';

export class NotificationPreferencesService {
  constructor(private readonly repository: NotificationPreferencesRepository) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const existing = await this.repository.findByUserId(userId);
    
    if (existing) {
      return existing;
    }

    // Create default preferences if they don't exist
    const created = await this.repository.create({
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    });

    return created;
  }

  async updatePreferences(
    userId: string,
    userEmail: string,
    updates: NotificationPreferencesUpdate
  ): Promise<NotificationPreferences> {
    const validated = NotificationPreferencesUpdateSchema.parse(updates);

    // Get current preferences (without auto-creating if they don't exist)
    const current = await this.repository.findByUserId(userId);

    // Handle Mailchimp subscription/unsubscription for promotional offers
    if (current && validated.promotionalOffers !== undefined && validated.promotionalOffers !== current.promotionalOffers) {
      if (validated.promotionalOffers) {
        // Get marketing data if user has personalized recommendations enabled
        const marketingData = await getUserMarketingData(userId);
        
        // Subscribe to Mailchimp with marketing data
        const result = await subscribeToMailchimp({
          email: userEmail,
          tags: ['promotional-offers'],
          marketingData: marketingData || undefined,
        });

        if (!result.success) {
          console.error('Failed to subscribe to Mailchimp:', result.error);
          // Don't fail the update, just log the error
        } else if (marketingData) {
          console.log(`Subscribed ${userEmail} to Mailchimp with marketing data:`, marketingData);
        }
      } else {
        // Unsubscribe from Mailchimp
        const result = await unsubscribeFromMailchimp({
          email: userEmail,
        });

        if (!result.success) {
          console.error('Failed to unsubscribe from Mailchimp:', result.error);
          // Don't fail the update, just log the error
        }
      }
    }

    // Update preferences in database
    const updated = await this.repository.upsert(userId, validated);

    return updated;
  }

  async getUsersWithPreference(
    preference: 'promotionalOffers' | 'teamUpdates' | 'newVideoContent'
  ): Promise<NotificationPreferences[]> {
    return this.repository.findUsersWithPreference(preference);
  }
}

