import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getMailchimpSubscribersCountByTag } from '@/lib/services/mailchimp-service';
import { getSiteModeConfiguration } from '@/modules/site-status/services/site-mode-service';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { logAdminRead } from '@/lib/security/admin-audit-logger';

const userProfileSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string().nullable(),
  status: z.string().nullable(),
  created_at: z.string(),
  referral_code: z.string().nullable().optional(),
  referred_by: z.string().nullable().optional(),
});

const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price_cents: z.coerce.number().optional(), // RPC returns price_cents instead of price
  stock_quantity: z.coerce.number().nullable(),
  images: z.any().optional(),
  created_at: z.string(),
  discount_type: z.string().nullable().optional(),
  discount_value: z.coerce.number().nullable().optional(),
  discount_label: z.string().nullable().optional(),
  is_featured: z.boolean().nullable().optional(),
  cart_visibility_countries: z.array(z.string()).nullable().optional(),
  related_product_ids: z.array(z.string()).nullable().optional(),
});

const productStockSchema = z.object({
  id: z.string(),
  name: z.string(),
  stockQuantity: z.coerce.number(),
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

const metricsRowSchema = z.object({
  total_users: z.coerce.number().nonnegative(),
  total_products: z.coerce.number().nonnegative(),
  active_subscriptions: z.coerce.number().nonnegative(),
  waitlisted_subscriptions: z.coerce.number().nonnegative().default(0),
  total_subscription_revenue: z.coerce.number(),
  total_order_revenue: z.coerce.number(),
  total_wallet_balance: z.coerce.number(),
  total_stock: z.coerce.number().nonnegative(),
  recent_users: z.array(userProfileSchema).default([]),
  recent_products: z.array(productSchema).default([]),
  product_stock: z.array(productStockSchema).default([]),
  recent_audit_logs: z.array(auditLogSchema).default([]),
});

// ✅ SECURITY: Use centralized admin client
import { getAdminClient } from '@/lib/supabase/admin';

// Alias for backward compatibility
const buildSupabaseAdminClient = getAdminClient;

const TOP_PRODUCTS_LIMIT = 4;

const productNameSchema = z.object({
  name: z.string().nullable(),
});

const orderItemRowSchema = z.object({
  product_id: z.string().nullable(),
  qty: z.coerce.number().nullable(),
  price_cents: z.coerce.number().nullable(),
  products: z.union([productNameSchema, z.array(productNameSchema)]).nullable(),
});

const fetchTopProductSales = async (
  supabase: SupabaseClient,
  limit: number = TOP_PRODUCTS_LIMIT,
  period?: string,
): Promise<Array<{ productId: string; name: string; unitsSold: number; revenueCents: number }>> => {
  let query = supabase
    .from('order_items')
    .select('product_id, qty, price_cents, products!inner(name), orders!inner(status, created_at)')
    .eq('orders.status', 'paid')
    .not('product_id', 'is', null);

  // Apply date filter based on period
  if (period && period !== 'all') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0); // Start of today
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7); // 7 days ago
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 31); // 31 days ago
        break;
      default:
        startDate = new Date(0); // Beginning of time
    }

    query = query.gte('orders.created_at', startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('[admin-dashboard] failed to load top product sales', error);
    return [];
  }

  const aggregates = new Map<string, { productId: string; name: string; unitsSold: number; revenueCents: number }>();

  const parseResult = orderItemRowSchema.array().safeParse(data ?? []);
  if (!parseResult.success) {
    console.error('[admin-dashboard] unexpected order item payload', parseResult.error);
    return [];
  }

  parseResult.data.forEach((row) => {
    const productId = row.product_id;
    if (!productId) {
      return;
    }

    const rawUnits = Number(row.qty ?? 0);
    const units = Number.isFinite(rawUnits) ? Math.max(0, rawUnits) : 0;
    const rawPriceCents = Number(row.price_cents ?? 0);
    const priceCents = Number.isFinite(rawPriceCents) ? Math.max(0, rawPriceCents) : 0;
    const revenueCents = units * priceCents;
    const productRelation = row.products;
    const relatedName = Array.isArray(productRelation)
      ? productRelation[0]?.name
      : productRelation?.name;
    const name = relatedName?.trim() || 'Unnamed product';

    const existing = aggregates.get(productId);
    if (existing) {
      existing.unitsSold += units;
      existing.revenueCents += revenueCents;
    } else {
      aggregates.set(productId, {
        productId,
        name,
        unitsSold: units,
        revenueCents,
      });
    }
  });

  return Array.from(aggregates.values())
    .filter((entry) => entry.unitsSold > 0 || entry.revenueCents > 0)
    .sort((a, b) => {
      if (b.revenueCents !== a.revenueCents) {
        return b.revenueCents - a.revenueCents;
      }
      return b.unitsSold - a.unitsSold;
    })
    .slice(0, limit);
};

/**
 * GET /api/admin/dashboard/metrics
 * Get dashboard metrics and statistics
 * Requires: view_dashboard permission
 */
export const GET = withAdminPermission('view_dashboard', async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const productsPeriod = searchParams.get('productsPeriod') || 'all';
    const activityPeriod = searchParams.get('activityPeriod') || 'all';

    const supabase = buildSupabaseAdminClient();

    // Fetch coming soon subscribers count from Mailchimp
    const getComingSoonCount = async (): Promise<number> => {
      try {
        const configuration = await getSiteModeConfiguration();
        const comingSoonSettings = configuration.modes.find((mode) => mode.mode === 'coming_soon');

        if (!comingSoonSettings?.mailchimpEnabled) {
          return 0;
        }

        const count = await getMailchimpSubscribersCountByTag('coming-soon', {
          apiKey: process.env.MAILCHIMP_API_KEY,
          serverPrefix: comingSoonSettings.mailchimpServerPrefix || undefined,
          audienceId: comingSoonSettings.mailchimpAudienceId || undefined,
        });

        return count;
      } catch (error) {
        console.warn('[admin-dashboard] Failed to fetch coming soon subscribers count', error);
        return 0;
      }
    };

    const [{ data, error }, topProductSales, comingSoonSubscribers] = await Promise.all([
      supabase.rpc('admin_dashboard_metrics_extended', { recent_limit: 5 }),
      fetchTopProductSales(supabase, TOP_PRODUCTS_LIMIT, productsPeriod),
      getComingSoonCount(),
    ]);

    if (error) {
      console.error('[admin-dashboard] metrics RPC failed', error);
      return NextResponse.json({ error: 'Failed to load admin metrics' }, { status: 500 });
    }

    const parsed = metricsRowSchema.parse((data ?? [])[0] ?? {});

    // Filter audit logs by activity period
    let filteredAuditLogs = parsed.recent_audit_logs;
    if (activityPeriod !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (activityPeriod) {
        case 'daily':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0); // Start of today
          break;
        case 'weekly':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7); // 7 days ago
          break;
        case 'monthly':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 31); // 31 days ago
          break;
        default:
          startDate = new Date(0); // Beginning of time
      }

      filteredAuditLogs = parsed.recent_audit_logs.filter((log) => {
        const logDate = new Date(log.created_at);
        return logDate >= startDate;
      });
    }

    // ✅ AUDIT: Log dashboard metrics access (sensitive data)
    await logAdminRead('dashboard_metrics', (request as any).user, {
      totalUsers: parsed.total_users,
      totalRevenueCents: parsed.total_subscription_revenue + parsed.total_order_revenue,
      productsPeriod,
      activityPeriod,
    });

    return NextResponse.json({
      totalUsers: parsed.total_users,
      totalProducts: parsed.total_products,
      activeSubscriptions: parsed.active_subscriptions,
      waitlistedSubscriptions: parsed.waitlisted_subscriptions ?? 0,
      totalSubscriptionRevenueCents: parsed.total_subscription_revenue,
      totalOrderRevenueCents: parsed.total_order_revenue,
      totalWalletBalanceCents: parsed.total_wallet_balance,
      totalStock: parsed.total_stock,
      comingSoonSubscribers,
      topProductSales,
      recentUsers: parsed.recent_users,
      recentProducts: parsed.recent_products,
      productStock: parsed.product_stock,
      recentAuditLogs: filteredAuditLogs,
    });
  } catch (error) {
    console.error('[admin-dashboard] unexpected metrics error', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error loading admin metrics';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    if (process.env.NODE_ENV !== 'production') {
      console.error('[admin-dashboard] Error stack:', errorStack);
    }

    return NextResponse.json({
      error: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { stack: errorStack })
    }, { status: 500 });
  }
});
