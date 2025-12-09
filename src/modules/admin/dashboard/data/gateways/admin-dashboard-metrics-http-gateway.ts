import { z } from 'zod';
import type {
  DashboardMetricsGateway,
  DashboardMetricsSnapshot,
} from '../../domain/contracts/dashboard-gateways';

// Simplified user schema that matches what the API actually returns
// The database function only returns: id, name, email, role, status, created_at
const dashboardUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string().nullable(),
  status: z.string().nullable(),
  created_at: z.string(),
  referral_code: z.string().nullable().optional(),
  referred_by: z.string().nullable().optional(),
});

// Simplified product schema that matches what the RPC function returns
// The database function only returns: id, name, slug, price_cents, stock_quantity, created_at
const dashboardProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  price_cents: z.coerce.number().optional(),
  stock_quantity: z.coerce.number().nullable(),
  created_at: z.string(),
});

const auditLogSchema = z.object({
  id: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  action: z.string(),
  actor_id: z.string().nullable(),
  changes: z.any(),
  created_at: z.string(),
  actor_name: z.string().nullable(),
  actor_email: z.string().nullable(),
});

const productStockSchema = z.object({
  id: z.string(),
  name: z.string(),
  stockQuantity: z.coerce.number(),
});

const metricsResponseSchema = z.object({
  totalSubscriptionRevenueCents: z.coerce.number().nonnegative(),
  totalOrderRevenueCents: z.coerce.number().nonnegative(),
  totalWalletBalanceCents: z.coerce.number(),
  activeSubscriptions: z.coerce.number().nonnegative(),
  waitlistedSubscriptions: z.coerce.number().nonnegative().default(0),
  totalUsers: z.coerce.number().nullable().default(0),
  totalProducts: z.coerce.number().nonnegative().default(0),
  totalStock: z.coerce.number().nonnegative().default(0),
  comingSoonSubscribers: z.coerce.number().nonnegative().default(0),
  topProductSales: z
    .array(
      z.object({
        productId: z.string().min(1),
        name: z.string().default(''),
        unitsSold: z.coerce.number().nonnegative(),
        revenueCents: z.coerce.number().nonnegative(),
      }),
    )
    .default([]),
  recentUsers: z.array(dashboardUserSchema).default([]),
  recentProducts: z.array(dashboardProductSchema).default([]),
  productStock: z.array(productStockSchema).default([]),
  recentAuditLogs: z.array(auditLogSchema).default([]),
});

interface FetchLike {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export class AdminDashboardMetricsHttpGateway implements DashboardMetricsGateway {
  constructor(private readonly fetcher: FetchLike = fetch) {}

  async getMetrics(productsPeriod?: string, activityPeriod?: string): Promise<DashboardMetricsSnapshot> {
    const url = new URL('/api/admin/dashboard/metrics', typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (productsPeriod) {
      url.searchParams.set('productsPeriod', productsPeriod);
    }
    if (activityPeriod) {
      url.searchParams.set('activityPeriod', activityPeriod);
    }

    const response = await this.fetcher(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to load admin metrics: ${response.status}`);
    }

    const json = await response.json();
    const parsed = metricsResponseSchema.parse(json);

    return {
      totalSubscriptionRevenueCents: parsed.totalSubscriptionRevenueCents,
      totalOrderRevenueCents: parsed.totalOrderRevenueCents,
      totalWalletBalanceCents: parsed.totalWalletBalanceCents,
      activeSubscriptions: parsed.activeSubscriptions,
      waitlistedSubscriptions: parsed.waitlistedSubscriptions ?? 0,
      totalUsers: parsed.totalUsers ?? 0,
      totalProducts: parsed.totalProducts ?? 0,
      totalStock: parsed.totalStock ?? 0,
      comingSoonSubscribers: parsed.comingSoonSubscribers ?? 0,
      topProductSales: parsed.topProductSales.map((item) => ({
        productId: item.productId,
        name: item.name.trim() || 'Unnamed product',
        unitsSold: item.unitsSold,
        revenueCents: item.revenueCents,
      })),
      // Transform simplified user data to match UserProfile type
      recentUsers: parsed.recentUsers.map((user) => ({
        id: user.id,
        name: user.name ?? '',
        email: user.email ?? '',
        role: (user.role as 'member' | 'admin') ?? 'member',
        status: (user.status as 'active' | 'inactive' | 'suspended') ?? 'active',
        pay: false,
        referral_code: user.referral_code ?? undefined,
        referred_by: user.referred_by ?? undefined,
        team_count: 0,
        phone: undefined,
        address: undefined,
        city: undefined,
        state: undefined,
        postal_code: undefined,
        country: undefined,
        default_payment_provider: undefined,
        avatar_url: undefined,
        commission_rate: 0.10,
        total_earnings: 0,
        created_at: user.created_at,
        updated_at: user.created_at, // Use created_at as fallback for updated_at
      })),
      recentProducts: parsed.recentProducts,
      productStock: parsed.productStock.map((item) => ({
        id: item.id,
        name: item.name,
        stockQuantity: item.stockQuantity,
      })),
      recentAuditLogs: parsed.recentAuditLogs.map((log) => ({
        id: log.id,
        entity_type: log.entity_type,
        entity_id: log.entity_id ?? undefined,
        action: log.action,
        user_id: log.actor_id ?? undefined,
        metadata: log.changes ?? {},
        created_at: log.created_at,
        profiles: log.actor_name && log.actor_email ? {
          id: log.actor_id ?? '',
          name: log.actor_name,
          email: log.actor_email,
        } : null,
      })),
    };
  }
}
