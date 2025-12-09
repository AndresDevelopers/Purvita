'use client';

import { useCallback } from 'react';
import type { OrderFulfillmentOrder } from '../domain/models/order-fulfillment';

export interface OrderFulfillmentExportLabels {
  fileNamePrefix: string;
  headers: {
    orderId: string;
    createdAt: string;
    status: string;
    purchaseSource: string;
    customer: string;
    email: string;
    phone: string;
    address: string;
    product: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    orderTotal: string;
    shipping: string;
    tax: string;
    discount: string;
    currency: string;
  };
}

interface UseOrderFulfillmentExportOptions {
  orders: OrderFulfillmentOrder[];
  selectedDate: string;
  timezone: string;
  labels: OrderFulfillmentExportLabels;
}

const centsToAmount = (value: number) => (value / 100).toFixed(2);

const formatDateTime = (iso: string, timezone: string) => {
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

const sanitize = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return '""';
  }
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

const buildAddress = (order: OrderFulfillmentOrder) => {
  const parts = [
    order.customer.addressLine,
    [order.customer.city, order.customer.state].filter(Boolean).join(', '),
    order.customer.postalCode,
    order.customer.country,
  ].filter((part) => Boolean(part && part.trim().length > 0));

  return parts.join(', ');
};

export const useOrderFulfillmentExport = ({
  orders,
  selectedDate,
  timezone,
  labels,
}: UseOrderFulfillmentExportOptions) => {
  return useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!orders.length) {
      return;
    }

    const headers = [
      labels.headers.orderId,
      labels.headers.createdAt,
      labels.headers.status,
      labels.headers.purchaseSource,
      labels.headers.customer,
      labels.headers.email,
      labels.headers.phone,
      labels.headers.address,
      labels.headers.product,
      labels.headers.quantity,
      labels.headers.unitPrice,
      labels.headers.lineTotal,
      labels.headers.orderTotal,
      labels.headers.shipping,
      labels.headers.tax,
      labels.headers.discount,
      labels.headers.currency,
    ];

    const rows: string[] = [];
    // European/Excel formatting often requires semicolon
    const delimiter = ';';

    for (const order of orders) {
      const address = buildAddress(order);

      if (order.items.length === 0) {
        rows.push(
          [
            sanitize(order.orderId),
            sanitize(formatDateTime(order.createdAt, timezone)),
            sanitize(order.status),
            sanitize(order.purchaseSource),
            sanitize(order.customer.name ?? ''),
            sanitize(order.customer.email ?? ''),
            sanitize(order.customer.phone ?? ''),
            sanitize(address),
            sanitize(''),
            sanitize('0'),
            sanitize('0.00'),
            sanitize('0.00'),
            sanitize(centsToAmount(order.totalCents)),
            sanitize(centsToAmount(order.shippingCents)),
            sanitize(centsToAmount(order.taxCents)),
            sanitize(centsToAmount(order.discountCents)),
            sanitize(order.currency),
          ].join(delimiter),
        );
        continue;
      }

      for (const item of order.items) {
        rows.push(
          [
            sanitize(order.orderId),
            sanitize(formatDateTime(order.createdAt, timezone)),
            sanitize(order.status),
            sanitize(order.purchaseSource),
            sanitize(order.customer.name ?? ''),
            sanitize(order.customer.email ?? ''),
            sanitize(order.customer.phone ?? ''),
            sanitize(address),
            sanitize(item.productName ?? ''),
            sanitize(item.quantity),
            sanitize(centsToAmount(item.unitPriceCents)),
            sanitize(centsToAmount(item.lineTotalCents)),
            sanitize(centsToAmount(order.totalCents)),
            sanitize(centsToAmount(order.shippingCents)),
            sanitize(centsToAmount(order.taxCents)),
            sanitize(centsToAmount(order.discountCents)),
            sanitize(order.currency),
          ].join(delimiter),
        );
      }
    }

    const csvContent = [headers.join(delimiter), ...rows].join('\r\n');

    // Aggressive sanitization to ensure valid filename
    const safePrefix = (labels?.fileNamePrefix || 'daily-orders').replace(/[^a-z0-9-_]/gi, '_');
    const safeDate = (selectedDate || 'date').replace(/[^a-z0-9-_]/gi, '_');
    const fileName = `${safePrefix}_${safeDate}.csv`;

    // Use File constructor if available (better filename handling) or fallback to Blob
    let url: string;
    try {
      // NOTE: Removed `sep=,` as it triggers some antivirus/security blocks
      const file = new File(["\uFEFF", csvContent], fileName, { type: 'text/csv;charset=utf-8' });
      url = URL.createObjectURL(file);
    } catch (_e) {
      // Fallback for older browsers
      const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8' });
      url = URL.createObjectURL(blob);
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    // Append to body to ensure it works in all browsers (Firefox requires this)
    document.body.appendChild(link);

    // Trigger download
    link.click();

    // Clean up with a small delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);
  }, [labels, orders, selectedDate, timezone]);
};
