import type { AdminDashboardData } from '../entities/admin-dashboard';

export type DatePeriod = 'daily' | 'weekly' | 'monthly' | 'all';

export interface AdminDashboardOverviewRequest {
  recentItemsLimit?: number;
  withAuditTrail?: boolean;
  productsPeriod?: DatePeriod;
  activityPeriod?: DatePeriod;
}

export interface AdminDashboardRepository {
  getOverview(request?: AdminDashboardOverviewRequest): Promise<AdminDashboardData>;
}
