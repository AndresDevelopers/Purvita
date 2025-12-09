'use client';

import type { PullToRefreshState } from '@/modules/admin/dashboard/hooks/use-pull-to-refresh';
import type {
  OrderFulfillmentOrder,
  OrderFulfillmentSummary,
} from '../domain/models/order-fulfillment';
import { OrderFulfillmentToolbar } from './components/order-fulfillment-toolbar';
import { OrderFulfillmentSummaryCards } from './components/order-fulfillment-summary';
import { OrderFulfillmentList } from './components/order-fulfillment-list';
import { OrderFulfillmentLoadingState } from './order-fulfillment-loading-state';
import { OrderFulfillmentEmptyState } from './order-fulfillment-empty-state';
import { OrderFulfillmentErrorState } from './order-fulfillment-error-state';

export interface OrderFulfillmentViewCopy {
  title: string;
  description: string;
  toolbar: {
    dateLabel: string;
    timezoneLabel: string;
    timezoneHint?: string;
    todayLabel: string;
    refreshLabel: string;
    download: {
      label: string;
      busyLabel: string;
      hint?: string;
      fileNamePrefix: string;
    };
    pullToRefresh: {
      idle: string;
      armed: string;
      triggered: string;
    };
  };
  summary: {
    totalOrders: string;
    totalUnits: string;
    totalRevenue: string;
    totalShipping: string;
    totalTax: string;
    totalDiscount: string;
  };
  list: {
    orderIdLabel: string;
    createdAtLabel: string;
    statusLabel: string;
    purchaseSourceLabel?: string;
    customerLabel: string;
    contactLabel: string;
    emailLabel?: string;
    phoneLabel?: string;
    addressLabel: string;
    itemsLabel: string;
    productLabel: string;
    quantityLabel: string;
    unitPriceLabel: string;
    lineTotalLabel: string;
    currencyLabel?: string;
    totals: {
      orderTotal: string;
      shipping: string;
      tax: string;
      discount: string;
      net: string;
    };
    noItemsLabel: string;
    statusBadges: Record<string, string>;
    purchaseSourceBadges?: Record<string, string>;
  };
  empty: {
    title: string;
    description: string;
    actionLabel: string;
  };
  error: {
    title: string;
    description: string;
    retryLabel: string;
  };
  meta: {
    generatedAtLabel: string;
  };
}

interface OrderFulfillmentViewProps {
  copy: OrderFulfillmentViewCopy;
  orders: OrderFulfillmentOrder[];
  summary: OrderFulfillmentSummary;
  selectedDate: string;
  timezone: string;
  availableDates: string[];
  generatedAt: string | null;
  loading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  pullState: PullToRefreshState;
  onDateChange: (date: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onToday: () => Promise<void>;
  onDownload: () => Promise<void>;
  downloading: boolean;
}

const formatTimestamp = (iso: string | null, timezone: string) => {
  if (!iso) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(iso));
  } catch (_error) {
    return new Date(iso).toLocaleString();
  }
};

export const OrderFulfillmentView = ({
  copy,
  orders,
  summary,
  selectedDate,
  timezone,
  availableDates,
  generatedAt,
  loading,
  isRefreshing,
  downloading,
  error,
  pullState,
  onDateChange,
  onRefresh,
  onToday,
  onDownload,
}: OrderFulfillmentViewProps) => {
  const hasOrders = orders.length > 0;
  const generatedAtLabel = formatTimestamp(generatedAt, timezone);
  const primaryCurrency = orders[0]?.currency ?? 'USD';
  const canDownload = hasOrders && !loading && !error;

  return (
    <section className="flex flex-col gap-6" data-testid="order-fulfillment-view">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{copy.title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{copy.description}</p>
        {generatedAtLabel && (
          <p className="text-xs text-muted-foreground">
            {copy.meta.generatedAtLabel}: {generatedAtLabel}
          </p>
        )}
      </header>

      <OrderFulfillmentToolbar
        copy={copy.toolbar}
        selectedDate={selectedDate}
        timezone={timezone}
        availableDates={availableDates}
        isRefreshing={isRefreshing}
        isDownloading={downloading}
        canDownload={canDownload}
        pullState={pullState}
        onDateChange={onDateChange}
        onToday={onToday}
        onRefresh={onRefresh}
        onDownload={onDownload}
      />

      {loading && !hasOrders && !error ? (
        <OrderFulfillmentLoadingState />
      ) : null}

      {!loading && error ? (
        <OrderFulfillmentErrorState
          title={copy.error.title}
          description={copy.error.description}
          retryLabel={copy.error.retryLabel}
          onRetry={() => {
            void onRefresh();
          }}
        />
      ) : null}

      {!loading && !error && !hasOrders ? (
        <OrderFulfillmentEmptyState
          title={copy.empty.title}
          description={copy.empty.description}
          actionLabel={copy.empty.actionLabel}
          onAction={() => {
            void onRefresh();
          }}
        />
      ) : null}

      {hasOrders ? (
        <div className="space-y-6">
          <OrderFulfillmentSummaryCards
            summary={summary}
            copy={copy.summary}
            currency={primaryCurrency}
          />
          <OrderFulfillmentList orders={orders} copy={copy.list} timezone={timezone} />
        </div>
      ) : null}
    </section>
  );
};
