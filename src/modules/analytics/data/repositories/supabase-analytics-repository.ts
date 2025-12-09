import { SupabaseClient } from '@supabase/supabase-js';
import type { IAnalyticsRepository } from '../../domain/contracts/analytics-repository';
import type {
  AnalyticsEvent,
  AnalyticsEventInput,
} from '../../domain/models/analytics-event';
import type {
  AnalyticsConfig,
  AnalyticsConfigUpdate,
} from '../../domain/models/analytics-config';
import type { MetricsQuery } from '../../domain/models/analytics-metrics';

/**
 * Supabase implementation of Analytics Repository
 */
export class SupabaseAnalyticsRepository implements IAnalyticsRepository {
  constructor(private supabase: SupabaseClient) {}

  // ==================== Events ====================

  async createEvent(event: AnalyticsEventInput): Promise<AnalyticsEvent> {
    const { data, error } = await this.supabase
      .from('analytics_events')
      .insert({
        event_type: event.event_type,
        event_name: event.event_name,
        user_id: event.user_id,
        session_id: event.session_id,
        params: event.params,
        user_agent: event.user_agent,
        ip_address: event.ip_address,
        referrer: event.referrer,
        timestamp: event.timestamp || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create analytics event: ${error.message}`);
    }

    return data as AnalyticsEvent;
  }

  async createEventsBatch(
    events: AnalyticsEventInput[]
  ): Promise<AnalyticsEvent[]> {
    const eventsToInsert = events.map((event) => ({
      event_type: event.event_type,
      event_name: event.event_name,
      user_id: event.user_id,
      session_id: event.session_id,
      params: event.params,
      user_agent: event.user_agent,
      ip_address: event.ip_address,
      referrer: event.referrer,
      timestamp: event.timestamp || new Date().toISOString(),
    }));

    const { data, error } = await this.supabase
      .from('analytics_events')
      .insert(eventsToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to create analytics events: ${error.message}`);
    }

    return data as AnalyticsEvent[];
  }

  async getEventsByUserId(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsEvent[]> {
    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get events by user: ${error.message}`);
    }

    return (data || []) as AnalyticsEvent[];
  }

  async getEventsBySessionId(sessionId: string): Promise<AnalyticsEvent[]> {
    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get events by session: ${error.message}`);
    }

    return (data || []) as AnalyticsEvent[];
  }

  async getEventsByType(
    eventType: string,
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<AnalyticsEvent[]> {
    let query = this.supabase
      .from('analytics_events')
      .select('*')
      .eq('event_type', eventType)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get events by type: ${error.message}`);
    }

    return (data || []) as AnalyticsEvent[];
  }

  async getEventsForMetrics(
    query: MetricsQuery,
    userId: string
  ): Promise<AnalyticsEvent[]> {
    const { startDate, endDate } = this.getDateRangeFromQuery(query);

    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get events for metrics: ${error.message}`);
    }

    return (data || []) as AnalyticsEvent[];
  }

  async deleteOldEvents(retentionDays: number, userId: string): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { error, count } = await this.supabase
      .from('analytics_events')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Failed to delete old events: ${error.message}`);
    }

    return count || 0;
  }

  // ==================== Configuration ====================

  async getConfig(userId: string): Promise<AnalyticsConfig | null> {
    const { data, error } = await this.supabase
      .from('analytics_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get analytics config: ${error.message}`);
    }

    return data as AnalyticsConfig | null;
  }

  async createConfig(userId: string): Promise<AnalyticsConfig> {
    const { data, error } = await this.supabase
      .from('analytics_config')
      .insert({
        user_id: userId,
        analytics_enabled: true,
        advanced_analytics_enabled: false,
        tracking_consent: false,
        anonymize_ip: true,
        data_retention_days: 90,
        weekly_report_enabled: false,
        monthly_report_enabled: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create analytics config: ${error.message}`);
    }

    return data as AnalyticsConfig;
  }

  async updateConfig(
    userId: string,
    updates: AnalyticsConfigUpdate
  ): Promise<AnalyticsConfig> {
    const { data, error } = await this.supabase
      .from('analytics_config')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update analytics config: ${error.message}`);
    }

    return data as AnalyticsConfig;
  }

  async isAdvancedAnalyticsEnabled(userId: string): Promise<boolean> {
    const config = await this.getConfig(userId);
    return config?.advanced_analytics_enabled || false;
  }

  async hasTrackingConsent(userId: string): Promise<boolean> {
    const config = await this.getConfig(userId);
    return config?.tracking_consent || false;
  }

  // ==================== Metrics Aggregation ====================

  async getTotalVisits(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('analytics_events')
      .select('session_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'pageview')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get total visits: ${error.message}`);
    }

    return count || 0;
  }

  async getUniqueVisitors(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Get distinct session IDs
    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('session_id')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get unique visitors: ${error.message}`);
    }

    const uniqueSessions = new Set((data || []).map((d) => d.session_id));
    return uniqueSessions.size;
  }

  async getTotalPageViews(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'pageview')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get total page views: ${error.message}`);
    }

    return count || 0;
  }

  async getTotalOrders(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'purchase')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get total orders: ${error.message}`);
    }

    return count || 0;
  }

  async getTotalRevenue(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('params')
      .eq('user_id', userId)
      .eq('event_type', 'purchase')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get total revenue: ${error.message}`);
    }

    const revenue = (data || []).reduce((sum, event) => {
      const value = parseFloat(event.params?.value || 0);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    return revenue;
  }

  async getTopProducts(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit = 5
  ): Promise<Array<{
    product_id: string;
    product_name: string;
    views: number;
    add_to_cart: number;
    purchases: number;
    revenue: number;
  }>> {
    // Get all product-related events
    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('event_type, params')
      .eq('user_id', userId)
      .in('event_type', ['product_view', 'add_to_cart', 'purchase'])
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get top products: ${error.message}`);
    }

    // Aggregate by product
    const productMap = new Map<string, {
      product_id: string;
      product_name: string;
      views: number;
      add_to_cart: number;
      purchases: number;
      revenue: number;
    }>();

    (data || []).forEach((event) => {
      const items = event.params?.items || [];
      items.forEach((item: any) => {
        const productId = item.item_id;
        if (!productId) return;

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_id: productId,
            product_name: item.item_name || productId,
            views: 0,
            add_to_cart: 0,
            purchases: 0,
            revenue: 0,
          });
        }

        const product = productMap.get(productId)!;

        if (event.event_type === 'product_view') {
          product.views += 1;
        } else if (event.event_type === 'add_to_cart') {
          product.add_to_cart += 1;
        } else if (event.event_type === 'purchase') {
          product.purchases += item.quantity || 1;
          product.revenue += (item.price || 0) * (item.quantity || 1);
        }
      });
    });

    // Sort by revenue and limit
    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  // ==================== Helper Methods ====================

  private getDateRangeFromQuery(query: MetricsQuery): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (query.period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        startDate = new Date(now.setDate(now.getDate() - 1));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last_7_days':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'last_30_days':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      case 'last_90_days':
        startDate = new Date(now.setDate(now.getDate() - 90));
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'custom':
        startDate = query.start_date ? new Date(query.start_date) : new Date(now.setDate(now.getDate() - 30));
        endDate = query.end_date ? new Date(query.end_date) : now;
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 30));
    }

    return { startDate, endDate };
  }
}
