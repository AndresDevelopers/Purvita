'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import type { OrderFulfillmentSummary } from '../../domain/models/order-fulfillment';

interface OrderFulfillmentSummaryCopy {
  totalOrders: string;
  totalUnits: string;
  totalRevenue: string;
  totalShipping: string;
  totalTax: string;
  totalDiscount: string;
}

interface OrderFulfillmentSummaryProps {
  summary: OrderFulfillmentSummary;
  copy: OrderFulfillmentSummaryCopy;
  currency: string;
}

const formatCurrency = (cents: number, currency: string) => {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (_error) {
    return `$${value.toFixed(2)}`;
  }
};

export const OrderFulfillmentSummaryCards = ({ summary, copy, currency }: OrderFulfillmentSummaryProps) => {
  const items = useMemo(
    () => [
      { label: copy.totalOrders, value: summary.totalOrders.toLocaleString() },
      { label: copy.totalUnits, value: summary.totalUnits.toLocaleString() },
      { label: copy.totalRevenue, value: formatCurrency(summary.totalRevenueCents, currency) },
      { label: copy.totalShipping, value: formatCurrency(summary.totalShippingCents, currency) },
      { label: copy.totalTax, value: formatCurrency(summary.totalTaxCents, currency) },
      { label: copy.totalDiscount, value: formatCurrency(summary.totalDiscountCents, currency) },
    ],
    [copy, currency, summary],
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.label}
          className="rounded-3xl border border-border/60 bg-background-light/90 p-5 text-left shadow-sm dark:border-border/40 dark:bg-background-dark/80"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-primary-dark dark:text-primary-light">{item.value}</p>
        </Card>
      ))}
    </div>
  );
};
