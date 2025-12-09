'use client';

import { useCallback, useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { PaymentHistoryModuleFactory } from '../factories/payment-history-factory';
import { usePaymentHistory } from '../hooks/use-payment-history';
import { usePaymentHistoryHaptics } from '../hooks/use-payment-history-haptics';
import { usePaymentHistoryToasts } from '../hooks/use-payment-history-toasts';
import { usePullToRefresh } from '@/modules/admin/dashboard/hooks/use-pull-to-refresh';
import type { PaymentHistoryFilter } from '../domain/models/payment-history-entry';
import { PaymentHistoryView, type PaymentHistoryViewCopy } from '../views/payment-history-view';

interface PaymentHistoryControllerProps {
  lang: Locale;
}

export const PaymentHistoryController = ({ lang }: PaymentHistoryControllerProps) => {
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [branding.appName, lang]);
  const { service, eventBus } = useMemo(() => PaymentHistoryModuleFactory.create(), []);
  const history = usePaymentHistory({ service, eventBus });
  usePaymentHistoryHaptics(eventBus);

  const toastsCopy = useMemo(() => {
    const paymentHistoryDict = dictionary?.admin?.paymentHistory ?? {} as any;
    return {
      paymentAdded: paymentHistoryDict.toasts?.paymentAdded ?? 'Payment registered successfully',
      paymentUpdated: paymentHistoryDict.toasts?.paymentUpdated ?? 'Payment status updated',
      scheduleUpdated: paymentHistoryDict.toasts?.scheduleUpdated ?? 'Schedule settings saved',
      errorTitle: paymentHistoryDict.toasts?.errorTitle ?? 'Something went wrong',
    };
  }, [dictionary]);

  usePaymentHistoryToasts(eventBus, toastsCopy);

  const pullState = usePullToRefresh(history.refresh, {
    enabled: !history.loading && !history.isSubmitting,
  });

  const copy = useMemo<PaymentHistoryViewCopy>(() => {
    const paymentHistoryDict = dictionary?.admin?.paymentHistory ?? {} as any as any as any as any as any as any as any;

    return {
      title: paymentHistoryDict.title ?? 'Payment history',
      description: paymentHistoryDict.description ?? 'Track member payments, upcoming charges and manual settlements.',
      refreshLabel: paymentHistoryDict.refreshLabel ?? 'Refresh',
      pullingLabel: paymentHistoryDict.pullingLabel ?? 'Release to refresh',
      stats: {
        total: paymentHistoryDict.stats?.total ?? 'Total records',
        paid: paymentHistoryDict.stats?.paid ?? 'Paid',
        pending: paymentHistoryDict.stats?.pending ?? 'Pending',
        overdue: paymentHistoryDict.stats?.overdue ?? 'Overdue',
        upcoming: paymentHistoryDict.stats?.upcoming ?? 'Upcoming',
      },
      filters: {
        all: paymentHistoryDict.filters?.all ?? 'All',
        paid: paymentHistoryDict.filters?.paid ?? 'Paid',
        pending: paymentHistoryDict.filters?.pending ?? 'Pending',
        overdue: paymentHistoryDict.filters?.overdue ?? 'Overdue',
        upcoming: paymentHistoryDict.filters?.upcoming ?? 'Upcoming',
      },
      table: {
        user: paymentHistoryDict.table?.user ?? 'Member',
        amount: paymentHistoryDict.table?.amount ?? 'Amount',
        dueDate: paymentHistoryDict.table?.dueDate ?? 'Due date',
        status: paymentHistoryDict.table?.status ?? 'Status',
        nextCharge: paymentHistoryDict.table?.nextCharge ?? 'Next charge',
        method: paymentHistoryDict.table?.method ?? 'Method',
        actions: paymentHistoryDict.table?.actions ?? 'Actions',
        manualLabel: paymentHistoryDict.table?.manualLabel ?? 'Manual entry',
        statusLabels: {
          paid: paymentHistoryDict.table?.statusLabels?.paid ?? 'Paid',
          pending: paymentHistoryDict.table?.statusLabels?.pending ?? 'Pending',
          overdue: paymentHistoryDict.table?.statusLabels?.overdue ?? 'Overdue',
          upcoming: paymentHistoryDict.table?.statusLabels?.upcoming ?? 'Upcoming',
        },
        markPaid: paymentHistoryDict.table?.markPaid ?? 'Mark paid',
        markPending: paymentHistoryDict.table?.markPending ?? 'Mark pending',
        markOverdue: paymentHistoryDict.table?.markOverdue ?? 'Mark overdue',
        approvePayout: paymentHistoryDict.table?.approvePayout ?? 'Approve payout',
        rejectPayout: paymentHistoryDict.table?.rejectPayout ?? 'Reject',
        empty: paymentHistoryDict.table?.empty ?? 'No payments to display yet.',
      },
      manualPayment: {
        triggerLabel: paymentHistoryDict.manualPayment?.triggerLabel ?? 'Add manual payment',
        title: paymentHistoryDict.manualPayment?.title ?? 'Register manual payment',
        description:
          paymentHistoryDict.manualPayment?.description ?? 'Record an offline payment to keep the member ledger up to date.',
        userIdLabel: paymentHistoryDict.manualPayment?.userIdLabel ?? 'Member ID',
        userIdPlaceholder: paymentHistoryDict.manualPayment?.userIdPlaceholder ?? 'Enter user ID',
        userNameLabel: paymentHistoryDict.manualPayment?.userNameLabel ?? 'Full name',
        userEmailLabel: paymentHistoryDict.manualPayment?.userEmailLabel ?? 'Email',
        amountLabel: paymentHistoryDict.manualPayment?.amountLabel ?? 'Amount received',
        methodLabel: paymentHistoryDict.manualPayment?.methodLabel ?? 'Payment method',
        notesLabel: paymentHistoryDict.manualPayment?.notesLabel ?? 'Notes',
        paidAtLabel: paymentHistoryDict.manualPayment?.paidAtLabel ?? 'Payment date',
        cancelLabel: paymentHistoryDict.manualPayment?.cancelLabel ?? 'Cancel',
        submitLabel: paymentHistoryDict.manualPayment?.submitLabel ?? 'Save payment',
        amountHint:
          paymentHistoryDict.manualPayment?.amountHint ?? 'Include taxes or discounts already applied to the final amount.',
        notesPlaceholder: paymentHistoryDict.manualPayment?.notesPlaceholder ?? 'Add internal notes for your team (optional)',
        searchingUser: paymentHistoryDict.manualPayment?.searchingUser ?? 'Searching user...',
        userNotFound: paymentHistoryDict.manualPayment?.userNotFound ?? 'User not found',
        loadingProviders: paymentHistoryDict.manualPayment?.loadingProviders ?? 'Loading payment methods...',
        noProvidersConfigured: paymentHistoryDict.manualPayment?.noProvidersConfigured ?? 'No payment providers configured. Please configure payment methods in settings.',
      },
      empty: {
        title: paymentHistoryDict.empty?.title ?? 'No payment activity yet',
        description:
          paymentHistoryDict.empty?.description ?? 'Manual payments will appear here once you register them or sync gateways.',
        actionLabel: paymentHistoryDict.empty?.actionLabel ?? 'Clear filters',
      },
      error: {
        title: paymentHistoryDict.error?.title ?? 'We could not load payments',
        description: paymentHistoryDict.error?.description ?? 'Please try refreshing or check your connection.',
        retryLabel: paymentHistoryDict.error?.retryLabel ?? 'Retry',
      },
      schedule: {
        title: paymentHistoryDict.schedule?.title ?? 'Payment cadence',
        description:
          paymentHistoryDict.schedule?.description ?? 'Configure the default charge timing for recurring subscriptions.',
        paymentModeLabel: paymentHistoryDict.schedule?.paymentModeLabel ?? 'Payment mode',
        paymentModeOptions: {
          manual: paymentHistoryDict.schedule?.paymentModeOptions?.manual ?? 'Manual approval',
          automatic: paymentHistoryDict.schedule?.paymentModeOptions?.automatic ?? 'Automatic processing',
        },
        paymentModeHint: {
          manual: paymentHistoryDict.schedule?.paymentModeHint?.manual ?? 'All payments will require manual approval from admin before being processed.',
          automatic: paymentHistoryDict.schedule?.paymentModeHint?.automatic ?? 'Payments will be processed automatically based on the configured schedule.',
        },
        frequencyLabel: paymentHistoryDict.schedule?.frequencyLabel ?? 'Frequency',
        frequencyOptions: {
          weekly: paymentHistoryDict.schedule?.frequencyOptions?.weekly ?? 'Weekly',
          biweekly: paymentHistoryDict.schedule?.frequencyOptions?.biweekly ?? 'Bi-weekly',
          monthly: paymentHistoryDict.schedule?.frequencyOptions?.monthly ?? 'Monthly',
        },
        dayOfMonthLabel: paymentHistoryDict.schedule?.dayOfMonthLabel ?? 'Charge day of the month',
        weekdayLabel: paymentHistoryDict.schedule?.weekdayLabel ?? 'Charge weekday',
        defaultAmountLabel: paymentHistoryDict.schedule?.defaultAmountLabel ?? 'Default charge amount',
        defaultAmountHint:
          paymentHistoryDict.schedule?.defaultAmountHint ?? 'Used to prefill manual payments and reminders.',
        remindersLabel: paymentHistoryDict.schedule?.remindersLabel ?? 'Reminder days (comma separated)',
        remindersHint:
          paymentHistoryDict.schedule?.remindersHint ?? 'Example: 3,1 sends reminders three days and one day before charge.',
        submitLabel: paymentHistoryDict.schedule?.submitLabel ?? 'Update schedule',
        savingLabel: paymentHistoryDict.schedule?.savingLabel ?? 'Saving…',
        lastUpdatedLabel: paymentHistoryDict.schedule?.lastUpdatedLabel ?? 'Last updated',
      },
    };
  }, [dictionary]);

  const handleFilterChange = useCallback(
    (nextFilter: PaymentHistoryFilter) => {
      history.setFilter(nextFilter);
    },
    [history],
  );

  return (
    <PaymentHistoryView
      lang={lang}
      copy={copy}
      entries={history.entries}
      stats={history.stats}
      schedule={history.schedule}
      loading={history.loading}
      error={history.error}
      isRefreshing={history.isRefreshing}
      isSubmitting={history.isSubmitting}
      filter={history.filter}
      pullState={pullState}
      onFilterChange={handleFilterChange}
      onManualPayment={history.addManualPayment}
      onMarkPaid={history.markAsPaid}
      onMarkPending={history.markAsPending}
      onMarkOverdue={history.markAsOverdue}
      onRefresh={history.refresh}
      onUpdateSchedule={history.updateSchedule}
    />
  );
};
