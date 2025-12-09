import type { IAnalyticsRepository } from '../domain/contracts/analytics-repository';
import type {
  BasicMetrics,
  AdvancedMetrics,
  AnalyticsMetrics,
  MetricsQuery,
  MetricsPeriod,
} from '../domain/models/analytics-metrics';
import type { AnalyticsEvent } from '../domain/models/analytics-event';

/**
 * Metrics Service
 * Calculates and aggregates analytics metrics
 */
export class MetricsService {
  constructor(private repository: IAnalyticsRepository) {}

  // ==================== Metrics Calculation ====================

  /**
   * Get complete metrics for a user
   */
  async getMetrics(
    userId: string,
    query: MetricsQuery
  ): Promise<AnalyticsMetrics> {
    const { startDate, endDate } = this.getDateRangeFromQuery(query);

    // Calculate basic metrics
    const basic = await this.calculateBasicMetrics(userId, startDate, endDate, query.period);

    // Calculate advanced metrics if requested and enabled
    let advanced: AdvancedMetrics | undefined;
    if (query.include_advanced) {
      const isEnabled = await this.repository.isAdvancedAnalyticsEnabled(userId);
      if (isEnabled) {
        advanced = await this.calculateAdvancedMetrics(userId, startDate, endDate);
      }
    }

    return { basic, advanced };
  }

  /**
   * Calculate basic metrics
   */
  private async calculateBasicMetrics(
    userId: string,
    startDate: Date,
    endDate: Date,
    period: MetricsPeriod
  ): Promise<BasicMetrics> {
    // Fetch all metrics in parallel for better performance
    const [
      totalVisits,
      uniqueVisitors,
      pageViews,
      totalOrders,
      totalRevenue,
      topProducts,
    ] = await Promise.all([
      this.repository.getTotalVisits(userId, startDate, endDate),
      this.repository.getUniqueVisitors(userId, startDate, endDate),
      this.repository.getTotalPageViews(userId, startDate, endDate),
      this.repository.getTotalOrders(userId, startDate, endDate),
      this.repository.getTotalRevenue(userId, startDate, endDate),
      this.repository.getTopProducts(userId, startDate, endDate, 5),
    ]);

    // Calculate derived metrics
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = uniqueVisitors > 0 ? (totalOrders / uniqueVisitors) * 100 : 0;

    return {
      total_visits: totalVisits,
      unique_visitors: uniqueVisitors,
      page_views: pageViews,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      avg_order_value: parseFloat(avgOrderValue.toFixed(2)),
      conversion_rate: parseFloat(conversionRate.toFixed(2)),
      top_products: topProducts,
      period,
      start_date: startDate,
      end_date: endDate,
    };
  }

  /**
   * Calculate advanced metrics
   */
  private async calculateAdvancedMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AdvancedMetrics> {
    // Get all events for advanced calculations
    const events = await this.repository.getEventsForMetrics(
      {
        period: 'custom',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        include_advanced: true,
      },
      userId
    );

    // Calculate funnel analysis
    const funnel = this.calculateFunnel(events);

    // Calculate time series
    const timeSeries = this.calculateTimeSeries(events);

    // Calculate device breakdown
    const devices = this.calculateDeviceBreakdown(events);

    return {
      funnel,
      time_series: timeSeries,
      devices,
    };
  }

  // ==================== Advanced Metrics Calculations ====================

  /**
   * Calculate conversion funnel
   */
  private calculateFunnel(events: AnalyticsEvent[]) {
    const productViews = events.filter((e) => e.event_type === 'product_view').length;
    const addToCarts = events.filter((e) => e.event_type === 'add_to_cart').length;
    const beginCheckouts = events.filter((e) => e.event_type === 'begin_checkout').length;
    const addPaymentInfos = events.filter((e) => e.event_type === 'add_payment_info').length;
    const purchases = events.filter((e) => e.event_type === 'purchase').length;

    return {
      product_views: productViews,
      add_to_cart: addToCarts,
      begin_checkout: beginCheckouts,
      add_payment_info: addPaymentInfos,
      purchase: purchases,
      cart_conversion: productViews > 0 ? (addToCarts / productViews) * 100 : 0,
      checkout_conversion: addToCarts > 0 ? (beginCheckouts / addToCarts) * 100 : 0,
      payment_conversion: beginCheckouts > 0 ? (addPaymentInfos / beginCheckouts) * 100 : 0,
      overall_conversion: productViews > 0 ? (purchases / productViews) * 100 : 0,
    };
  }

  /**
   * Calculate time series data
   */
  private calculateTimeSeries(events: AnalyticsEvent[]) {
    const dailyData = new Map<string, { visits: number; revenue: number; orders: number }>();

    events.forEach((event) => {
      const date = new Date(event.timestamp || event.created_at || '').toISOString().split('T')[0];

      if (!dailyData.has(date)) {
        dailyData.set(date, { visits: 0, revenue: 0, orders: 0 });
      }

      const data = dailyData.get(date)!;

      if (event.event_type === 'pageview') {
        data.visits += 1;
      } else if (event.event_type === 'purchase') {
        data.orders += 1;
        data.revenue += parseFloat(event.params?.value?.toString() || '0');
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        visits: data.visits,
        revenue: parseFloat(data.revenue.toFixed(2)),
        orders: data.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate device breakdown
   */
  private calculateDeviceBreakdown(events: AnalyticsEvent[]) {
    const devices = { desktop: 0, mobile: 0, tablet: 0 };

    events.forEach((event) => {
      const userAgent = event.user_agent?.toLowerCase() || '';

      if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
        devices.mobile += 1;
      } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
        devices.tablet += 1;
      } else {
        devices.desktop += 1;
      }
    });

    return devices;
  }

  // ==================== Helper Methods ====================

  /**
   * Get date range from query
   */
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

  /**
   * Format number as currency
   */
  static formatCurrency(value: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  /**
   * Calculate growth rate
   */
  static calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}
