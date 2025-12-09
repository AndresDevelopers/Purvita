import type { Product } from '@/lib/models/definitions';
import type { UserProfile } from '@/lib/models/definitions';
import type { AuditLogWithProfile } from '@/lib/services/audit-log-service';
import type { ProductInventorySummary, ProductInventoryRecord } from '@/modules/products/domain/models/product-inventory';
import type { ProductSalesPerformance } from '../entities/admin-dashboard';

export interface ProductMetricsGateway {
  getProductsCount(): Promise<number>;
  getRecentProducts(limit: number): Promise<Product[]>;
  getProductStockSummary(): Promise<ProductInventorySummary>;
}

export interface UserMetricsGateway {
  getUsersCount(): Promise<number>;
  getRecentUsers(limit: number): Promise<UserProfile[]>;
}

export interface AuditTrailGateway {
  getRecentAuditLogs(entity: string, limit: number): Promise<AuditLogWithProfile[]>;
}

export interface DashboardMetricsSnapshot {
  totalSubscriptionRevenueCents: number;
  totalOrderRevenueCents: number;
  totalWalletBalanceCents: number;
  activeSubscriptions: number;
  waitlistedSubscriptions: number;
  totalUsers: number | null;
  totalProducts: number;
  totalStock: number;
  comingSoonSubscribers: number;
  topProductSales: ProductSalesPerformance[];
  recentUsers: UserProfile[];
  recentProducts: Product[];
  productStock: ProductInventoryRecord[];
  recentAuditLogs: AuditLogWithProfile[];
}

export interface DashboardMetricsGateway {
  getMetrics(productsPeriod?: string, activityPeriod?: string): Promise<DashboardMetricsSnapshot>;
}
