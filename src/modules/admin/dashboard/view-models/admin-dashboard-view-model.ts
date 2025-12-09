import type { Locale } from '@/i18n/config';
import type { AppDictionary } from '@/i18n/dictionaries';
import type { AdminDashboardData } from '../domain/entities/admin-dashboard';

export type AdminDashboardStatusTone = 'success' | 'warning' | 'info';

export interface AdminDashboardStatCard {
  title: string;
  value: string;
  icon: 'users' | 'subscriptions' | 'revenue' | 'inventory' | 'wallet' | 'waitlist' | 'email';
}

export interface AdminDashboardActivityRow {
  id: string;
  user: string;
  product: string;
  date: string;
  statusLabel: string;
  statusTone: AdminDashboardStatusTone;
  entityType: string;
}

export interface AdminDashboardTopProductRow {
  id: string;
  name: string;
  salesLabel: string;
  revenueLabel: string;
}

export interface AdminDashboardInventoryRow {
  id: string;
  name: string;
  stockLabel: string;
}

export interface AdminDashboardCopy {
  heading: string;
  recentActivityHeading: string;
  topProductsHeading: string;
  inventoryHeading: string;
  inventorySummary: string;
  loadingLabel: string;
  columns: {
    activity: {
      user: string;
      product: string;
      date: string;
      status: string;
    };
    products: {
      product: string;
      sales: string;
      revenue: string;
    };
    inventory: {
      product: string;
      stock: string;
    };
  };
  emptyMessages: {
    activity: string;
    products: string;
    inventory: string;
  };
}

export interface AdminDashboardViewModel {
  statCards: AdminDashboardStatCard[];
  activityRows: AdminDashboardActivityRow[];
  topProductRows: AdminDashboardTopProductRow[];
  inventoryRows: AdminDashboardInventoryRow[];
  copy: AdminDashboardCopy;
}

const fallback = <T>(value: T | undefined, fallbackValue: T): T => {
  return value === undefined || value === null ? fallbackValue : value;
};

const getLocaleTag = (lang: Locale) => (lang === 'es' ? 'es-ES' : 'en-US');

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasProperty = <K extends string>(value: unknown, key: K): value is Record<K, unknown> & Record<string, unknown> => {
  return isRecord(value) && key in value;
};

const extractTopSellingLabel = (adminDict: unknown): string | undefined => {
  if (!hasProperty(adminDict, 'productSalesSummary')) {
    return undefined;
  }

  const productSummary = adminDict.productSalesSummary;

  if (!hasProperty(productSummary, 'topSelling')) {
    return undefined;
  }

  const topSelling = productSummary.topSelling;

  if (!hasProperty(topSelling, 'label')) {
    return undefined;
  }

  const { label } = topSelling;

  return typeof label === 'string' ? label : undefined;
};

interface BuildOptions {
  lang: Locale;
  dict: AppDictionary;
  data: AdminDashboardData;
}

const statusToneByAction: Record<string, { template: { es: string; en: string }; tone: AdminDashboardStatusTone }> = {
  PRODUCT_CREATED: {
    template: { en: 'Product added: {{entity}}', es: 'Producto agregado: {{entity}}' },
    tone: 'success',
  },
  PRODUCT_UPDATED: {
    template: { en: 'Product updated: {{entity}}', es: 'Producto actualizado: {{entity}}' },
    tone: 'warning',
  },
  PRODUCT_DELETED: {
    template: { en: 'Product removed: {{entity}}', es: 'Producto eliminado: {{entity}}' },
    tone: 'info',
  },
  ORDER_PAID: {
    template: { en: 'Order paid: {{entity}}', es: 'Orden pagada: {{entity}}' },
    tone: 'success',
  },
  SUBSCRIPTION_ACTIVATED: {
    template: { en: 'Subscription activated: {{entity}}', es: 'Suscripción activada: {{entity}}' },
    tone: 'success',
  },
  SUBSCRIPTION_CANCELED: {
    template: { en: 'Subscription canceled: {{entity}}', es: 'Suscripción cancelada: {{entity}}' },
    tone: 'info',
  },
  WALLET_RECHARGED: {
    template: { en: 'Wallet recharged: {{entity}}', es: 'Billetera recargada: {{entity}}' },
    tone: 'success',
  },
};

const entityTypeLabels: Record<string, { en: string; es: string }> = {
  product: { en: 'Product', es: 'Producto' },
  user: { en: 'User', es: 'Usuario' },
  subscription: { en: 'Subscription', es: 'Suscripción' },
  wallet: { en: 'Wallet', es: 'Billetera' },
  order: { en: 'Order', es: 'Orden' },
};

const normalizeEntityType = (entityType: string | null | undefined): string => {
  if (!entityType) {
    return 'unknown';
  }
  return String(entityType).toLowerCase();
};

const extractMetadataString = (metadata: unknown, keys: string[]): string | null => {
  if (isRecord(metadata)) {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }

    if (hasProperty(metadata, 'product') && isRecord(metadata.product)) {
      return extractMetadataString(metadata.product, keys);
    }
  }

  return null;
};

const getActivityEntityName = (metadata: unknown, fallback?: string | null): string => {
  const candidate = extractMetadataString(metadata, ['name', 'productName', 'title', 'email', 'slug']);
  if (candidate) {
    return candidate;
  }

  if (typeof fallback === 'string') {
    const trimmed = fallback.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return 'Unknown';
};

const formatStatusLabel = (
  action: string,
  lang: Locale,
  entityName: string,
  defaultEntityLabel: string,
): { label: string; tone: AdminDashboardStatusTone } => {
  const config = statusToneByAction[action];
  if (!config) {
    const readableAction = action.replace(/_/g, ' ').toLowerCase();
    const prefix = lang === 'es' ? 'Evento' : 'Event';
    return {
      label: `${prefix} ${readableAction}: ${entityName || defaultEntityLabel}`.trim(),
      tone: 'info',
    };
  }

  const template = config.template[lang] ?? config.template.en;
  const label = template.includes('{{entity}}')
    ? template.replace('{{entity}}', entityName || defaultEntityLabel)
    : `${template}: ${entityName || defaultEntityLabel}`;

  return { label, tone: config.tone };
};

export const buildAdminDashboardViewModel = ({ lang, dict, data }: BuildOptions): AdminDashboardViewModel => {
  const localeTag = getLocaleTag(lang);
  const numberFormatter = new Intl.NumberFormat(localeTag);
  const currencyFormatter = new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  const dateFormatter = new Intl.DateTimeFormat(localeTag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const subscriptionRevenue = (data.totalSubscriptionRevenueCents ?? 0) / 100;
  const orderRevenue = (data.totalOrderRevenueCents ?? 0) / 100;
  const walletLiability = (data.totalWalletBalanceCents ?? 0) / 100;

  const statCards: AdminDashboardStatCard[] = [
    {
      icon: 'revenue',
      title: fallback(dict?.admin?.totalRevenue, 'Total Revenue'),
      value: currencyFormatter.format(data.totalRevenue ?? subscriptionRevenue + orderRevenue),
    },
    {
      icon: 'subscriptions',
      title: fallback(dict?.admin?.activeSubscriptions, 'Active Subscriptions'),
      value: numberFormatter.format(data.activeSubscriptions ?? 0),
    },
    {
      icon: 'revenue',
      title: fallback(dict?.admin?.subscriptionRevenue, 'Monthly Subscription Revenue'),
      value: currencyFormatter.format(subscriptionRevenue),
    },
    {
      icon: 'revenue',
      title: fallback(dict?.admin?.ecommerceRevenue, 'E-commerce Revenue'),
      value: currencyFormatter.format(orderRevenue),
    },
    {
      icon: 'wallet',
      title: fallback(dict?.admin?.walletLiability, 'Wallet Balance Outstanding'),
      value: currencyFormatter.format(walletLiability),
    },
    {
      icon: 'users',
      title: fallback(dict?.admin?.totalUsers, 'Total Users'),
      value: numberFormatter.format(data.totalUsers ?? 0),
    },
    {
      icon: 'inventory',
      title: fallback(dict?.admin?.totalStock, 'Total Stock'),
      value: numberFormatter.format(data.totalStock ?? 0),
    },
    {
      icon: 'email',
      title: fallback(dict?.admin?.comingSoonSubscribers, 'Coming Soon Subscribers'),
      value: numberFormatter.format(data.comingSoonSubscribers ?? 0),
    },
  ];

  const activityRows: AdminDashboardActivityRow[] = (data.recentActivities ?? []).slice(0, 5).map((activity) => {
    const entityType = normalizeEntityType((activity as unknown as { entity_type?: string }).entity_type);
    const entityLabels = entityTypeLabels[entityType] ?? {
      en: entityType === 'unknown' ? 'Entity' : entityType,
      es: entityType === 'unknown' ? 'Entidad' : entityType,
    };
    const localizedEntityLabel = entityLabels[lang] ?? entityLabels.en;
    const entityDisplayName = getActivityEntityName(activity.metadata, activity.entity_id);
    const subject = entityDisplayName ? `${localizedEntityLabel}: ${entityDisplayName}` : localizedEntityLabel;

    const { label: statusLabel, tone: statusTone } = formatStatusLabel(
      activity.action,
      lang,
      entityDisplayName,
      localizedEntityLabel,
    );

    return {
      id: activity.id,
      user: activity.profiles?.name || activity.profiles?.email || 'Unknown',
      product: subject,
      entityType,
      date: dateFormatter.format(new Date(activity.created_at)),
      statusLabel,
      statusTone,
    };
  });

  const productSalesSource = (data.topProductSales ?? []).length > 0
    ? (data.topProductSales ?? [])
    : (data.recentProducts ?? []).map((product) => ({
        productId: product.id,
        name: product.name,
        unitsSold: 0,
        revenueCents: 0,
      }));

  const sortedProductSales = [...productSalesSource].sort((a, b) => {
    const aUnits = a.unitsSold ?? 0;
    const bUnits = b.unitsSold ?? 0;

    if (bUnits !== aUnits) {
      return bUnits - aUnits;
    }

    const aRevenue = a.revenueCents ?? 0;
    const bRevenue = b.revenueCents ?? 0;
    return bRevenue - aRevenue;
  });

  const topProductRows: AdminDashboardTopProductRow[] = sortedProductSales.slice(0, 4).map((entry) => ({
    id: entry.productId,
    name: entry.name,
    salesLabel: numberFormatter.format(entry.unitsSold ?? 0),
    revenueLabel: currencyFormatter.format((entry.revenueCents ?? 0) / 100),
  }));

  const inventoryRows: AdminDashboardInventoryRow[] = [...(data.productStock ?? [])]
    .sort((a, b) => b.stockQuantity - a.stockQuantity)
    .map((item) => ({
      id: item.id,
      name: item.name,
      stockLabel: numberFormatter.format(item.stockQuantity ?? 0),
    }));

  const topSellingLabel = extractTopSellingLabel(dict?.admin);

  const entityColumnLabel = lang === 'es' ? 'Entidad' : 'Entity';

  const copy: AdminDashboardCopy = {
    heading: fallback(dict?.admin?.dashboard, 'Dashboard'),
    recentActivityHeading: fallback(dict?.admin?.recentActivity, 'Recent Activity'),
    topProductsHeading: fallback(
      topSellingLabel ?? dict?.admin?.products ?? dict?.admin?.totalProducts,
      'Top Selling Products',
    ),
    inventoryHeading: fallback(dict?.admin?.inventoryOverview, 'Inventory Overview'),
    inventorySummary: fallback(
      dict?.admin?.inventorySummary,
      'Track the stock available for each product and restock proactively.',
    ),
    loadingLabel: lang === 'es' ? 'Cargando.' : 'Loading.',
    columns: {
      activity: {
        user: fallback(dict?.admin?.user, 'User'),
        product: entityColumnLabel,
        date: lang === 'es' ? 'Fecha' : 'Date',
        status: fallback(dict?.admin?.status, 'Status'),
      },
      products: {
        product: fallback(dict?.admin?.products, 'Product'),
        sales: lang === 'es' ? 'Ventas' : 'Sales',
        revenue: fallback(dict?.admin?.totalRevenue, 'Revenue'),
      },
      inventory: {
        product: fallback(dict?.admin?.products, 'Product'),
        stock: fallback(dict?.admin?.stockQuantity, 'Stock'),
      },
    },
    emptyMessages: {
      activity: lang === 'es' ? 'No hay actividades recientes' : 'No recent activity yet',
      products: lang === 'es' ? 'No hay productos disponibles' : 'No products available',
      inventory: lang === 'es' ? 'No hay inventario registrado' : 'No inventory recorded yet',
    },
  };
  return {
    statCards,
    activityRows,
    topProductRows,
    inventoryRows,
    copy,
  };
};
