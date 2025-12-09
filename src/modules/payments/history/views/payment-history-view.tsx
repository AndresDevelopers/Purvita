'use client';

import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import type { PaymentHistoryEntry, PaymentHistoryFilter, PaymentStatus, ManualPaymentInput } from '../domain/models/payment-history-entry';
import type { PaymentScheduleConfig, PaymentScheduleUpdateInput } from '../domain/models/payment-schedule';
import type { PullToRefreshState } from '@/modules/admin/dashboard/hooks/use-pull-to-refresh';
import { PaymentHistoryStats } from '../components/payment-history-stats';
import { PaymentHistoryTable, type PaymentHistoryTableCopy } from '../components/payment-history-table';
import { ManualPaymentDialog, type ManualPaymentDialogCopy } from '../components/manual-payment-dialog';
import { PaymentScheduleForm, type PaymentScheduleFormCopy } from '../components/payment-schedule-form';
import { PaymentHistoryEmptyState } from './payment-history-empty-state';
import { PaymentHistoryErrorState } from './payment-history-error-state';
import { PaymentHistorySkeleton } from './payment-history-skeleton';

export interface PaymentHistoryViewCopy {
  title: string;
  description: string;
  refreshLabel: string;
  pullingLabel: string;
  stats: {
    total: string;
    paid: string;
    pending: string;
    overdue: string;
    upcoming: string;
  };
  filters: {
    all: string;
    paid: string;
    pending: string;
    overdue: string;
    upcoming: string;
  };
  table: PaymentHistoryTableCopy;
  manualPayment: ManualPaymentDialogCopy;
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
  schedule: PaymentScheduleFormCopy;
}

interface PaymentHistoryViewProps {
  lang: Locale;
  copy: PaymentHistoryViewCopy;
  entries: PaymentHistoryEntry[];
  stats: Record<PaymentStatus, number> & { total: number };
  schedule: PaymentScheduleConfig | null;
  loading: boolean;
  error: Error | null;
  isRefreshing: boolean;
  isSubmitting: boolean;
  filter: PaymentHistoryFilter;
  pullState: PullToRefreshState;
  onFilterChange: (filter: PaymentHistoryFilter) => void;
  onManualPayment: (input: ManualPaymentInput) => Promise<void>;
  onMarkPaid: (id: string) => void;
  onMarkPending: (id: string) => void;
  onMarkOverdue: (id: string) => void;
  onRefresh: () => void;
  onUpdateSchedule: (input: PaymentScheduleUpdateInput) => Promise<void>;
}

const statusFilters: PaymentStatus[] = ['paid', 'pending', 'overdue', 'upcoming'];

export const PaymentHistoryView = ({
  lang,
  copy,
  entries,
  stats,
  schedule,
  loading,
  error,
  isRefreshing,
  isSubmitting,
  filter,
  pullState,
  onFilterChange,
  onManualPayment,
  onMarkPaid,
  onMarkPending,
  onMarkOverdue,
  onRefresh,
  onUpdateSchedule,
}: PaymentHistoryViewProps) => {
  const currency = schedule?.currency ?? 'USD';

  const activeFilter = filter.status ?? 'all';

  const filterChips = useMemo(
    () => [
      { value: 'all', label: copy.filters.all },
      ...statusFilters.map((status) => ({ value: status, label: copy.filters[status] })),
    ],
    [copy.filters],
  );

  if (loading && entries.length === 0) {
    return <PaymentHistorySkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={onRefresh} disabled={loading} className="h-11 rounded-full px-5">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {copy.refreshLabel}
          </Button>
          <ManualPaymentDialog
            copy={copy.manualPayment}
            currency={currency}
            onSubmit={onManualPayment}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {pullState.status !== 'idle' ? (
        <div className="flex items-center justify-center rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-medium text-primary">
          {copy.pullingLabel}
        </div>
      ) : null}

      {error && entries.length === 0 ? (
        <PaymentHistoryErrorState
          title={copy.error.title}
          description={copy.error.description}
          retryLabel={copy.error.retryLabel}
          onRetry={onRefresh}
        />
      ) : (
        <>
          <PaymentHistoryStats stats={stats} copy={copy.stats} />

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {filterChips.map((chip) => (
                <Button
                  key={chip.value}
                  variant={chip.value === activeFilter ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() =>
                    onFilterChange({ status: chip.value === 'all' ? undefined : (chip.value as PaymentStatus) })
                  }
                >
                  {chip.label}
                </Button>
              ))}
            </div>

            {entries.length === 0 ? (
              <PaymentHistoryEmptyState
                title={copy.empty.title}
                description={copy.empty.description}
                actionLabel={copy.empty.actionLabel}
                onAction={() => onFilterChange({})}
              />
            ) : (
              <PaymentHistoryTable
                lang={lang}
                entries={entries}
                loading={loading}
                copy={copy.table}
                isManualMode={schedule?.paymentMode === 'manual'}
                onMarkPaid={onMarkPaid}
                onMarkPending={onMarkPending}
                onMarkOverdue={onMarkOverdue}
              />
            )}
          </div>

          <PaymentScheduleForm
            copy={copy.schedule}
            schedule={schedule}
            currency={currency}
            onSubmit={onUpdateSchedule}
            isSubmitting={isSubmitting}
          />
        </>
      )}
    </div>
  );
};
