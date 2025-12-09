import type { Product, UserProfile } from '@/lib/models/definitions';
import type { AuditLogWithProfile } from '@/lib/services/audit-log-service';
import type { ProductInventoryRecord } from '@/modules/products/domain/models/product-inventory';

export interface ProductSalesPerformance {
  productId: string;
  name: string;
  unitsSold: number;
  revenueCents: number;
}

export interface AdminDashboardData {
  totalUsers: number;
  totalProducts: number;
  activeSubscriptions: number;
  waitlistedSubscriptions: number;
  totalRevenue: number;
  totalSubscriptionRevenueCents: number;
  totalOrderRevenueCents: number;
  totalWalletBalanceCents: number;
  totalStock: number;
  comingSoonSubscribers: number;
  productStock: ProductInventoryRecord[];
  recentProducts: Product[];
  topProductSales: ProductSalesPerformance[];
  recentActivities: AuditLogWithProfile[];
  recentUsers: UserProfile[];
}

export interface AdminDashboardOverview {
  metrics: Pick<
    AdminDashboardData,
    | 'totalUsers'
    | 'totalProducts'
    | 'activeSubscriptions'
    | 'totalRevenue'
    | 'totalStock'
  > & {
    totalSubscriptionRevenueCents: number;
    totalOrderRevenueCents: number;
    totalWalletBalanceCents: number;
  };
  recentUsers: AdminDashboardData['recentUsers'];
  recentProducts: AdminDashboardData['recentProducts'];
  topProductSales: AdminDashboardData['topProductSales'];
  recentActivities: AdminDashboardData['recentActivities'];
}
