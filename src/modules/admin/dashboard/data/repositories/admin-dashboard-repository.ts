import type {
  AdminDashboardRepository,
  AdminDashboardOverviewRequest,
} from '../../domain/contracts/admin-dashboard-repository';
import type {
  ProductMetricsGateway,
  UserMetricsGateway,
  AuditTrailGateway,
  DashboardMetricsGateway,
  DashboardMetricsSnapshot as _DashboardMetricsSnapshot,
} from '../../domain/contracts/dashboard-gateways';
import type { AdminDashboardData } from '../../domain/entities/admin-dashboard';

export interface AdminDashboardRepositoryDependencies {
  productGateway: ProductMetricsGateway;
  userGateway: UserMetricsGateway;
  auditGateway: AuditTrailGateway;
  metricsGateway: DashboardMetricsGateway;
}

export class AdminDashboardRepositoryImpl implements AdminDashboardRepository {
  constructor(private readonly deps: AdminDashboardRepositoryDependencies) {}

  async getOverview(request: AdminDashboardOverviewRequest = {}): Promise<AdminDashboardData> {
    // All data now comes from a single optimized RPC call via metricsGateway
    // This eliminates the N+1 query problem
    const metrics = await this.deps.metricsGateway
      .getMetrics(request.productsPeriod, request.activityPeriod)
      .catch((error) => {
        console.error('Admin dashboard metrics failed. Returning fallback data.', error);
        return null;
      });

    if (!metrics) {
      // Return fallback data if metrics fetch fails
      return {
        totalUsers: 0,
        totalProducts: 0,
        activeSubscriptions: 0,
        waitlistedSubscriptions: 0,
        totalRevenue: 0,
        totalSubscriptionRevenueCents: 0,
        totalOrderRevenueCents: 0,
        totalWalletBalanceCents: 0,
        totalStock: 0,
        comingSoonSubscribers: 0,
        productStock: [],
        recentUsers: [],
        recentProducts: [],
        topProductSales: [],
        recentActivities: [],
      };
    }

    const {
      activeSubscriptions = 0,
      waitlistedSubscriptions = 0,
      totalSubscriptionRevenueCents = 0,
      totalOrderRevenueCents = 0,
      totalWalletBalanceCents = 0,
      totalUsers = 0,
      totalProducts = 0,
      totalStock = 0,
      comingSoonSubscribers = 0,
      topProductSales = [],
      recentUsers = [],
      recentProducts = [],
      productStock = [],
      recentAuditLogs = [],
    } = metrics;

    return {
      totalUsers: totalUsers ?? 0,
      totalProducts,
      activeSubscriptions,
      waitlistedSubscriptions,
      totalRevenue: (totalSubscriptionRevenueCents + totalOrderRevenueCents) / 100,
      totalSubscriptionRevenueCents,
      totalOrderRevenueCents,
      totalWalletBalanceCents,
      totalStock,
      comingSoonSubscribers,
      productStock,
      recentUsers,
      recentProducts,
      topProductSales,
      recentActivities: recentAuditLogs,
    };
  }
}
