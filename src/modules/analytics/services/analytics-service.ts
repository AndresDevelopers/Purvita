import type { IAnalyticsRepository } from '../domain/contracts/analytics-repository';
import type {
  AnalyticsEvent,
  AnalyticsEventInput,
} from '../domain/models/analytics-event';
import type {
  AnalyticsConfig,
  AnalyticsConfigUpdate,
  PrivacyConsent,
} from '../domain/models/analytics-config';

/**
 * Analytics Service
 * Business logic for analytics operations
 */
export class AnalyticsService {
  constructor(private repository: IAnalyticsRepository) {}

  // ==================== Event Tracking ====================

  /**
   * Track a single event
   */
  async trackEvent(event: AnalyticsEventInput): Promise<AnalyticsEvent> {
    // Check if user has tracking consent (if user_id is provided)
    if (event.user_id) {
      const hasConsent = await this.repository.hasTrackingConsent(event.user_id);
      if (!hasConsent) {
        // If no consent, anonymize the event
        event.user_id = null;
      }

      // Check if analytics is enabled
      const config = await this.repository.getConfig(event.user_id);
      if (config && !config.analytics_enabled) {
        throw new Error('Analytics is disabled for this user');
      }

      // Anonymize IP if required
      if (config?.anonymize_ip && event.ip_address) {
        event.ip_address = this.anonymizeIP(event.ip_address);
      }
    }

    return this.repository.createEvent(event);
  }

  /**
   * Track multiple events in batch
   */
  async trackEventsBatch(events: AnalyticsEventInput[]): Promise<AnalyticsEvent[]> {
    // Process each event for consent and anonymization
    const processedEvents = await Promise.all(
      events.map(async (event) => {
        if (event.user_id) {
          const config = await this.repository.getConfig(event.user_id);

          if (config && !config.analytics_enabled) {
            return null; // Skip disabled users
          }

          const hasConsent = await this.repository.hasTrackingConsent(event.user_id);
          if (!hasConsent) {
            event.user_id = null;
          }

          if (config?.anonymize_ip && event.ip_address) {
            event.ip_address = this.anonymizeIP(event.ip_address);
          }
        }
        return event;
      })
    );

    // Filter out null events
    const validEvents = processedEvents.filter((e): e is AnalyticsEventInput => e !== null);

    if (validEvents.length === 0) {
      return [];
    }

    return this.repository.createEventsBatch(validEvents);
  }

  /**
   * Get events for a user
   */
  async getUserEvents(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsEvent[]> {
    return this.repository.getEventsByUserId(userId, startDate, endDate);
  }

  /**
   * Get session events
   */
  async getSessionEvents(sessionId: string): Promise<AnalyticsEvent[]> {
    return this.repository.getEventsBySessionId(sessionId);
  }

  // ==================== Configuration ====================

  /**
   * Get or create user analytics configuration
   */
  async getOrCreateConfig(userId: string): Promise<AnalyticsConfig> {
    let config = await this.repository.getConfig(userId);

    if (!config) {
      config = await this.repository.createConfig(userId);
    }

    return config;
  }

  /**
   * Update user analytics configuration
   */
  async updateConfig(
    userId: string,
    updates: AnalyticsConfigUpdate
  ): Promise<AnalyticsConfig> {
    return this.repository.updateConfig(userId, updates);
  }

  /**
   * Enable advanced analytics for a user
   * This should be called when a user purchases the advanced analytics feature
   */
  async enableAdvancedAnalytics(userId: string): Promise<AnalyticsConfig> {
    return this.repository.updateConfig(userId, {
      advanced_analytics_enabled: true,
    });
  }

  /**
   * Disable advanced analytics for a user
   */
  async disableAdvancedAnalytics(userId: string): Promise<AnalyticsConfig> {
    return this.repository.updateConfig(userId, {
      advanced_analytics_enabled: false,
    });
  }

  /**
   * Update privacy consent
   */
  async updatePrivacyConsent(
    userId: string,
    consent: PrivacyConsent
  ): Promise<AnalyticsConfig> {
    const updates: AnalyticsConfigUpdate = {
      tracking_consent: consent.tracking_consent,
    };

    if (consent.anonymize_ip !== undefined) {
      updates.anonymize_ip = consent.anonymize_ip;
    }

    return this.repository.updateConfig(userId, updates);
  }

  /**
   * Check if user has advanced analytics enabled
   */
  async hasAdvancedAnalytics(userId: string): Promise<boolean> {
    return this.repository.isAdvancedAnalyticsEnabled(userId);
  }

  /**
   * Check if user has given tracking consent
   */
  async hasTrackingConsent(userId: string): Promise<boolean> {
    return this.repository.hasTrackingConsent(userId);
  }

  // ==================== Data Management ====================

  /**
   * Clean up old events based on retention policy
   */
  async cleanupOldEvents(userId: string): Promise<number> {
    const config = await this.repository.getConfig(userId);
    const retentionDays = config?.data_retention_days || 90;

    return this.repository.deleteOldEvents(retentionDays, userId);
  }

  // ==================== Helper Methods ====================

  /**
   * Anonymize IP address (remove last octet for IPv4, last 80 bits for IPv6)
   */
  private anonymizeIP(ip: string): string {
    if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::';
    } else {
      // IPv4
      const parts = ip.split('.');
      return parts.slice(0, 3).join('.') + '.0';
    }
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Validate event parameters
   */
  static validateEvent(event: AnalyticsEventInput): boolean {
    if (!event.event_type) return false;
    if (!event.session_id) return false;
    if (!event.params) return false;
    return true;
  }
}
