'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { usePullToRefresh } from '@/modules/admin/dashboard/hooks/use-pull-to-refresh';
import { OrderFulfillmentModuleFactory } from '../factories/order-fulfillment-module';
import { useOrderFulfillment } from '../hooks/use-order-fulfillment';
import { useOrderFulfillmentHaptics } from '../hooks/use-order-fulfillment-haptics';
import { useOrderFulfillmentExport } from '../hooks/use-order-fulfillment-export';
import { useAvailableDates } from '../hooks/use-available-dates';
import { OrderFulfillmentView } from '../views/order-fulfillment-view';

interface OrderFulfillmentControllerProps {
  lang: Locale;
}

export const OrderFulfillmentController = ({ lang }: OrderFulfillmentControllerProps) => {
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [branding.appName, lang]);
  const { service, eventBus } = useMemo(() => OrderFulfillmentModuleFactory.create(), []);
  const state = useOrderFulfillment({ service, eventBus });
  useOrderFulfillmentHaptics(eventBus);
  const { availableDates } = useAvailableDates();
  const [isExporting, setIsExporting] = useState(false);

  const pullState = usePullToRefresh(state.refresh, {
    enabled: !state.loading && !state.isRefreshing,
  });

  const copy = useMemo(() => {
    const ordersDict = dictionary?.admin?.orders ?? {} as any as any as any as any as any;
    const toolbarDict = ordersDict.toolbar ?? {};
    const summaryDict = ordersDict.summary ?? {};
    const listDict = ordersDict.list ?? {};
    const totalsDict = listDict.totals ?? {};

    return {
      title: ordersDict.title ?? 'Daily orders',
      description:
        ordersDict.description
        ?? 'Review paid orders, packaging notes and delivery details to coordinate with the warehouse team.',
      toolbar: {
        dateLabel: toolbarDict.dateLabel ?? 'Select day',
        timezoneLabel: toolbarDict.timezoneLabel ?? 'Timezone',
        timezoneHint: toolbarDict.timezoneHint,
        todayLabel: toolbarDict.todayLabel ?? 'Today',
        refreshLabel: toolbarDict.refreshLabel ?? 'Refresh',
        download: {
          label: toolbarDict.download?.label ?? 'Download CSV',
          busyLabel: toolbarDict.download?.busyLabel ?? 'Preparing',
          hint: toolbarDict.download?.hint,
          fileNamePrefix: toolbarDict.download?.fileNamePrefix ?? 'daily-orders',
        },
        pullToRefresh: {
          idle: toolbarDict.pullToRefresh?.idle ?? 'Pull down to refresh orders',
          armed: toolbarDict.pullToRefresh?.armed ?? 'Release to refresh',
          triggered: toolbarDict.pullToRefresh?.triggered ?? 'Refreshing orders…',
        },
      },
      summary: {
        totalOrders: summaryDict.totalOrders ?? 'Orders',
        totalUnits: summaryDict.totalUnits ?? 'Units',
        totalRevenue: summaryDict.totalRevenue ?? 'Gross revenue',
        totalShipping: summaryDict.totalShipping ?? 'Shipping',
        totalTax: summaryDict.totalTax ?? 'Tax',
        totalDiscount: summaryDict.totalDiscount ?? 'Discounts',
      },
      list: {
        orderIdLabel: listDict.orderIdLabel ?? 'Order',
        createdAtLabel: listDict.createdAtLabel ?? 'Created at',
        statusLabel: listDict.statusLabel ?? 'Status',
        purchaseSourceLabel: listDict.purchaseSourceLabel ?? 'Purchase Source',
        customerLabel: listDict.customerLabel ?? 'Customer',
        contactLabel: listDict.contactLabel ?? 'Contact',
        emailLabel: listDict.emailLabel ?? 'Email',
        phoneLabel: listDict.phoneLabel ?? 'Phone',
        addressLabel: listDict.addressLabel ?? 'Shipping address',
        itemsLabel: listDict.itemsLabel ?? 'Items',
        productLabel: listDict.productLabel ?? 'Product',
        quantityLabel: listDict.quantityLabel ?? 'Qty',
        unitPriceLabel: listDict.unitPriceLabel ?? 'Unit price',
        lineTotalLabel: listDict.lineTotalLabel ?? 'Line total',
        currencyLabel: listDict.currencyLabel ?? 'Currency',
        totals: {
          orderTotal: totalsDict.orderTotal ?? 'Order total',
          shipping: totalsDict.shipping ?? 'Shipping',
          tax: totalsDict.tax ?? 'Tax',
          discount: totalsDict.discount ?? 'Discount',
          net: totalsDict.net ?? 'Net payable',
        },
        noItemsLabel: listDict.noItemsLabel ?? 'No line items registered for this order.',
        statusBadges: listDict.statusBadges ?? {},
        purchaseSourceBadges: listDict.purchaseSourceBadges ?? {},
      },
      empty: {
        title: ordersDict.empty?.title ?? 'No orders for this day',
        description:
          ordersDict.empty?.description
          ?? 'There are no paid orders for the selected date. Choose another day or refresh to check again.',
        actionLabel: ordersDict.empty?.actionLabel ?? 'Refresh',
      },
      error: {
        title: ordersDict.error?.title ?? 'Unable to load orders',
        description:
          ordersDict.error?.description
          ?? 'We could not reach the fulfillment service. Check your connection and try again.',
        retryLabel: ordersDict.error?.retryLabel ?? 'Retry',
      },
      meta: {
        generatedAtLabel: ordersDict.meta?.generatedAtLabel ?? 'Last synced',
      },
    };
  }, [dictionary]);

  const handleDateChange = useCallback(
    async (value: string) => {
      await state.setDate(value);
    },
    [state],
  );

  const handleRefresh = useCallback(async () => {
    await state.refresh();
  }, [state]);

  const handleToday = useCallback(async () => {
    await state.goToToday();
  }, [state]);

  const exportLabels = useMemo(
    () => ({
      fileNamePrefix: copy.toolbar.download.fileNamePrefix,
      headers: {
        orderId: copy.list.orderIdLabel,
        createdAt: copy.list.createdAtLabel,
        status: copy.list.statusLabel,
        purchaseSource: copy.list.purchaseSourceLabel ?? 'Purchase Source',
        customer: copy.list.customerLabel,
        email: copy.list.emailLabel ?? 'Email',
        phone: copy.list.phoneLabel ?? 'Phone',
        address: copy.list.addressLabel,
        product: copy.list.productLabel,
        quantity: copy.list.quantityLabel,
        unitPrice: copy.list.unitPriceLabel,
        lineTotal: copy.list.lineTotalLabel,
        orderTotal: copy.list.totals.orderTotal,
        shipping: copy.list.totals.shipping,
        tax: copy.list.totals.tax,
        discount: copy.list.totals.discount,
        currency: copy.list.currencyLabel ?? 'Currency',
      },
    }),
    [copy],
  );

  const exportOrders = useOrderFulfillmentExport({
    orders: state.orders,
    selectedDate: state.selectedDate,
    timezone: state.timezone,
    labels: exportLabels,
  });

  const handleDownload = useCallback(async () => {
    if (state.orders.length === 0) {
      return;
    }
    setIsExporting(true);
    try {
      await exportOrders();
    } catch (error) {
      console.error('[OrderFulfillmentController] Failed to export orders', error);
    } finally {
      setIsExporting(false);
    }
  }, [exportOrders, state.orders.length]);

  return (
    <OrderFulfillmentView
      copy={copy}
      orders={state.orders}
      summary={state.summary}
      selectedDate={state.selectedDate}
      timezone={state.timezone}
      availableDates={availableDates}
      generatedAt={state.generatedAt}
      loading={state.loading}
      isRefreshing={state.isRefreshing}
      downloading={isExporting}
      error={state.error}
      pullState={pullState}
      onDateChange={handleDateChange}
      onRefresh={handleRefresh}
      onToday={handleToday}
      onDownload={handleDownload}
    />
  );
};
