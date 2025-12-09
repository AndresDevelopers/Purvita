import {
  getProductsCount,
  getRecentProducts,
  getProductStockSummary,
} from '@/lib/services/product-service';
import { getUsersCount, getRecentUsers } from '@/lib/services/user-service';
import { getRecentAuditLogs } from '@/lib/services/audit-log-service';
import {
  getActiveSubscriptionsCount as _getActiveSubscriptionsCount,
  getWaitlistedSubscriptionsCount as _getWaitlistedSubscriptionsCount,
  getSubscriptionRevenue as _getSubscriptionRevenue,
  getOrderRevenue as _getOrderRevenue,
  getTotalWalletBalance as _getTotalWalletBalance,
} from '@/lib/services/dashboard-metrics-service';
import { AdminDashboardEventBus } from '../domain/events/admin-dashboard-event-bus';
import type {
  ProductMetricsGateway,
  UserMetricsGateway,
  AuditTrailGateway,
  DashboardMetricsGateway,
} from '../domain/contracts/dashboard-gateways';
import type { AdminDashboardRepository } from '../domain/contracts/admin-dashboard-repository';
import { AdminDashboardRepositoryImpl } from '../data/repositories/admin-dashboard-repository';
import { AdminDashboardMetricsHttpGateway } from '../data/gateways/admin-dashboard-metrics-http-gateway';

export interface AdminDashboardModule {
  repository: AdminDashboardRepository;
  eventBus: AdminDashboardEventBus;
}

export const createAdminDashboardModule = (): AdminDashboardModule => {
  const productGateway: ProductMetricsGateway = {
    getProductsCount,
    getRecentProducts,
    getProductStockSummary,
  };

  const userGateway: UserMetricsGateway = {
    getUsersCount,
    getRecentUsers,
  };

  const auditGateway: AuditTrailGateway = {
    getRecentAuditLogs,
  };

  const metricsGateway: DashboardMetricsGateway = new AdminDashboardMetricsHttpGateway();

  const repository: AdminDashboardRepository = new AdminDashboardRepositoryImpl({
    productGateway,
    userGateway,
    auditGateway,
    metricsGateway,
  });

  const eventBus = new AdminDashboardEventBus();

  return { repository, eventBus };
};
