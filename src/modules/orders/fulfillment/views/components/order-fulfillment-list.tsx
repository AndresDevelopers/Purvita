'use client';

import { Mail, MapPin, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { OrderFulfillmentOrder } from '../../domain/models/order-fulfillment';

interface OrderFulfillmentListCopy {
  orderIdLabel: string;
  createdAtLabel: string;
  statusLabel: string;
  purchaseSourceLabel?: string;
  customerLabel: string;
  contactLabel: string;
  addressLabel: string;
  itemsLabel: string;
  productLabel: string;
  quantityLabel: string;
  unitPriceLabel: string;
  lineTotalLabel: string;
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
}

interface OrderFulfillmentListProps {
  orders: OrderFulfillmentOrder[];
  copy: OrderFulfillmentListCopy;
  timezone: string;
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

const formatDateTime = (iso: string, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(iso));
  } catch (_error) {
    return new Date(iso).toLocaleString();
  }
};

const statusColorMap: Record<string, string> = {
  paid: 'bg-emerald-600/10 text-emerald-700 border border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200',
  pending: 'bg-amber-500/10 text-amber-700 border border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-200',
  draft: 'bg-muted text-foreground border border-border/60 dark:bg-background-dark/80 dark:text-foreground',
  failed: 'bg-rose-500/10 text-rose-600 border border-rose-400/50 dark:bg-rose-400/10 dark:text-rose-200',
  canceled: 'bg-slate-500/10 text-slate-600 border border-slate-400/40 dark:bg-slate-400/10 dark:text-slate-200',
  refunded: 'bg-blue-500/10 text-blue-600 border border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-200',
};

const resolveStatusBadge = (status: string) => statusColorMap[status] ?? 'bg-primary/10 text-primary border border-primary/40';

const formatAddress = (order: OrderFulfillmentOrder) => {
  const parts = [
    order.customer.addressLine,
    [order.customer.city, order.customer.state].filter(Boolean).join(', '),
    order.customer.postalCode,
    order.customer.country,
  ].filter((part) => Boolean(part && part.trim().length > 0));

  if (parts.length === 0) {
    return null;
  }

  return parts.join('\n');
};

export const OrderFulfillmentList = ({ orders, copy, timezone }: OrderFulfillmentListProps) => (
  <div className="space-y-5">
    {orders.map((order) => {
      const address = formatAddress(order);
      const statusLabel = copy.statusBadges[order.status] ?? order.status;
      const purchaseSourceLabel = copy.purchaseSourceBadges?.[order.purchaseSource] ?? order.purchaseSource;

      return (
        <Card
          key={order.orderId}
          className="space-y-5 rounded-3xl border border-border/70 bg-background-light/90 p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md dark:border-border/40 dark:bg-background-dark/80"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.orderIdLabel}
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {order.orderId}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{copy.createdAtLabel}:</span>
                <span>{formatDateTime(order.createdAt, timezone)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-foreground">{copy.statusLabel}:</span>
                <Badge className={resolveStatusBadge(order.status)}>{statusLabel}</Badge>
              </div>
              {copy.purchaseSourceLabel && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-foreground">{copy.purchaseSourceLabel}:</span>
                  <Badge
                    className={
                      order.purchaseSource === 'affiliate_store'
                        ? 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700'
                        : 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                    }
                  >
                    {purchaseSourceLabel}
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border/50 bg-background/60 p-4 text-sm shadow-inner dark:border-border/40 dark:bg-background-dark/60">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {copy.totals.net}
              </span>
              <span className="text-xl font-semibold text-primary-dark dark:text-primary-light">
                {formatCurrency(order.totalCents, order.currency)}
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{copy.totals.shipping}</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(order.shippingCents, order.currency)}
                </span>
                <span>{copy.totals.tax}</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(order.taxCents, order.currency)}
                </span>
                <span>{copy.totals.discount}</span>
                <span className="text-right font-medium text-foreground">
                  -{formatCurrency(order.discountCents, order.currency)}
                </span>
                <span>{copy.totals.orderTotal}</span>
                <span className="text-right font-semibold text-primary-dark dark:text-primary-light">
                  {formatCurrency(order.totalCents, order.currency)}
                </span>
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background/70 p-4 text-sm shadow-inner dark:border-border/40 dark:bg-background-dark/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.customerLabel}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {order.customer.name ?? copy.customerLabel}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.contactLabel}
                </p>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {order.customer.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" aria-hidden />
                      <span className="break-all">{order.customer.email}</span>
                    </p>
                  )}
                  {order.customer.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" aria-hidden />
                      <span>{order.customer.phone}</span>
                    </p>
                  )}
                  {!order.customer.email && !order.customer.phone && (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.addressLabel}
                </p>
                {address ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                    <MapPin className="mr-2 inline h-4 w-4" aria-hidden />
                    {address}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background-light/80 shadow-inner dark:border-border/40 dark:bg-background-dark/70">
              <div className="border-b border-border/40 bg-background/70 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground dark:border-border/40">
                {copy.itemsLabel}
              </div>
              {order.items.length > 0 ? (
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-1/2 text-xs uppercase tracking-wide text-muted-foreground">
                        {copy.productLabel}
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                        {copy.quantityLabel}
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                        {copy.unitPriceLabel}
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                        {copy.lineTotalLabel}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.itemId} className="hover:bg-background/50">
                        <TableCell className="text-sm font-medium text-foreground">
                          {item.productName ?? copy.productLabel}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {item.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {formatCurrency(item.unitPriceCents, order.currency)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground">
                          {formatCurrency(item.lineTotalCents, order.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-4 py-6 text-sm text-muted-foreground">{copy.noItemsLabel}</p>
              )}
            </div>
          </div>
        </Card>
      );
    })}
  </div>
);
