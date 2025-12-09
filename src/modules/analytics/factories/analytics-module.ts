import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAnalyticsRepository } from '../data/repositories/supabase-analytics-repository';
import { AnalyticsService } from '../services/analytics-service';
import { MetricsService } from '../services/metrics-service';

/**
 * Analytics Module Factory
 * Creates and wires up analytics dependencies
 */
export class AnalyticsModuleFactory {
  private static analyticsServiceInstance: AnalyticsService | null = null;
  private static metricsServiceInstance: MetricsService | null = null;

  /**
   * Create Analytics Service
   */
  static createAnalyticsService(supabase: SupabaseClient): AnalyticsService {
    if (!this.analyticsServiceInstance) {
      const repository = new SupabaseAnalyticsRepository(supabase);
      this.analyticsServiceInstance = new AnalyticsService(repository);
    }
    return this.analyticsServiceInstance;
  }

  /**
   * Create Metrics Service
   */
  static createMetricsService(supabase: SupabaseClient): MetricsService {
    if (!this.metricsServiceInstance) {
      const repository = new SupabaseAnalyticsRepository(supabase);
      this.metricsServiceInstance = new MetricsService(repository);
    }
    return this.metricsServiceInstance;
  }

  /**
   * Create Repository
   */
  static createRepository(supabase: SupabaseClient): SupabaseAnalyticsRepository {
    return new SupabaseAnalyticsRepository(supabase);
  }

  /**
   * Reset instances (useful for testing)
   */
  static reset(): void {
    this.analyticsServiceInstance = null;
    this.metricsServiceInstance = null;
  }
}
