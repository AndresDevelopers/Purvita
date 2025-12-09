'use client';

import { Download, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PullToRefreshState } from '@/modules/admin/dashboard/hooks/use-pull-to-refresh';
import { DatePickerWithDisabledDates } from './date-picker-with-disabled-dates';

interface OrderFulfillmentToolbarCopy {
  dateLabel: string;
  timezoneLabel: string;
  timezoneHint?: string;
  todayLabel: string;
  refreshLabel: string;
  download: {
    label: string;
    busyLabel: string;
    hint?: string;
  };
  pullToRefresh: {
    idle: string;
    armed: string;
    triggered: string;
  };
}

interface OrderFulfillmentToolbarProps {
  copy: OrderFulfillmentToolbarCopy;
  selectedDate: string;
  timezone: string;
  availableDates: string[];
  isRefreshing: boolean;
  isDownloading: boolean;
  canDownload: boolean;
  pullState: PullToRefreshState;
  onDateChange: (value: string) => Promise<void> | void;
  onToday: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onDownload: () => Promise<void> | void;
}

export const OrderFulfillmentToolbar = ({
  copy,
  selectedDate,
  timezone,
  availableDates,
  isRefreshing,
  isDownloading,
  canDownload,
  pullState,
  onDateChange,
  onToday,
  onRefresh,
  onDownload,
}: OrderFulfillmentToolbarProps) => {
  const pullLabel =
    pullState.status === 'triggered'
      ? copy.pullToRefresh.triggered
      : pullState.status === 'armed'
        ? copy.pullToRefresh.armed
        : copy.pullToRefresh.idle;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background-light/80 p-4 shadow-sm transition-colors dark:border-border/40 dark:bg-background-dark/80 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.dateLabel}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <DatePickerWithDisabledDates
            selectedDate={selectedDate}
            availableDates={availableDates}
            onDateChange={onDateChange}
            disabled={isRefreshing}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void onToday();
            }}
            className="h-11 rounded-full border-primary/40 px-5 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            {copy.todayLabel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{copy.timezoneLabel}:</span> {timezone}
          {copy.timezoneHint ? ` · ${copy.timezoneHint}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <div className="flex w-full flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            disabled={isRefreshing}
            className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90"
          >
            <RotateCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? `${copy.refreshLabel}…` : copy.refreshLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void onDownload();
            }}
            disabled={!canDownload || isDownloading}
            className="h-11 rounded-full border-primary/40 px-5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-border/50 disabled:text-muted-foreground"
          >
            <Download className={`mr-2 h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`} />
            {isDownloading ? `${copy.download.busyLabel}…` : copy.download.label}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">{pullLabel}</span>
        {copy.download.hint ? (
          <span className="text-xs text-muted-foreground">{copy.download.hint}</span>
        ) : null}
      </div>
    </div>
  );
};
