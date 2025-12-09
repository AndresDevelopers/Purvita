import type {
  AnalyticsEvent,
  AnalyticsEventInput,
} from '../models/analytics-event';
import type {
  AnalyticsConfig,
  AnalyticsConfigUpdate,
} from '../models/analytics-config';
import type { MetricsQuery } from '../models/analytics-metrics';

/**
 * Analytics Repository Contract
 * Defines data access operations for analytics
 */
export interface IAnalyticsRepository {
  // ==================== Events ====================

  /**
   * Create a new analytics event
   */
  createEvent(event: AnalyticsEventInput): Promise<AnalyticsEvent>;

  /**
   * Create multiple analytics events in batch
   */
  createEventsBatch(events: AnalyticsEventInput[]): Promise<AnalyticsEvent[]>;

  /**
   * Get events for a user within a date range
   */
  getEventsByUserId(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsEvent[]>;

  /**
   * Get events by session ID
   */
  getEventsBySessionId(sessionId: string): Promise<AnalyticsEvent[]>;

  /**
   * Get events by type within a date range
   */
  getEventsByType(
    eventType: string,
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<AnalyticsEvent[]>;

  /**
   * Get raw events for metrics calculation
   */
  getEventsForMetrics(
    query: MetricsQuery,
    userId: string
  ): Promise<AnalyticsEvent[]>;

  /**
   * Delete old events (data retention)
   */
  deleteOldEvents(retentionDays: number, userId: string): Promise<number>;

  // ==================== Configuration ====================

  /**
   * Get analytics configuration for a user
   */
  getConfig(userId: string): Promise<AnalyticsConfig | null>;

  /**
   * Create analytics configuration for a user
   */
  createConfig(userId: string): Promise<AnalyticsConfig>;

  /**
   * Update analytics configuration
   */
  updateConfig(
    userId: string,
    updates: AnalyticsConfigUpdate
  ): Promise<AnalyticsConfig>;

  /**
   * Check if advanced analytics is enabled for a user
   */
  isAdvancedAnalyticsEnabled(userId: string): Promise<boolean>;

  /**
   * Check if user has given tracking consent
   */
  hasTrackingConsent(userId: string): Promise<boolean>;

  // ==================== Metrics Aggregation ====================

  /**
   * Get total visits for a period
   */
  getTotalVisits(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Get unique visitors for a period
   */
  getUniqueVisitors(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Get total page views for a period
   */
  getTotalPageViews(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Get total orders for a period
   */
  getTotalOrders(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Get total revenue for a period
   */
  getTotalRevenue(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Get top products for a period
   */
  getTopProducts(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<Array<{
    product_id: string;
    product_name: string;
    views: number;
    add_to_cart: number;
    purchases: number;
    revenue: number;
  }>>;
}
