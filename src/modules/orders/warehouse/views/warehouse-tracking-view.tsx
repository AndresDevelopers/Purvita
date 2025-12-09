'use client';

import { useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import {
  type WarehouseTrackingCreateInput,
  type WarehouseTrackingDictionary,
  type WarehouseTrackingEvent,
  type WarehouseTrackingUpdateInput,
  WAREHOUSE_TRACKING_STATUSES,
} from '../domain/models/warehouse-tracking';
import { WarehouseTrackingForm } from './warehouse-tracking-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useInfiniteScroll } from '@/modules/admin/dashboard/hooks/use-infinite-scroll';

interface WarehouseTrackingViewProps {
  dictionary: WarehouseTrackingDictionary;
  lang: Locale;
  entries: WarehouseTrackingEvent[];
  loading: boolean;
  loadingMore: boolean;
  creating: boolean;
  updatingId: string | null;
  error: string | null;
  statusFilter: string | null;
  searchTerm: string;
  hasMore: boolean;
  onCreate: (input: WarehouseTrackingCreateInput) => Promise<WarehouseTrackingEvent>;
  onUpdate: (entryId: string, input: WarehouseTrackingUpdateInput) => Promise<WarehouseTrackingEvent>;
  onRetry: () => void;
  onStatusChange: (status: string | null) => void;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
}

const formatDate = (value: string | null, locale: Locale) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

const formatDateTime = (value: string | null, locale: Locale) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

export const WarehouseTrackingView = ({
  dictionary,
  lang,
  entries,
  loading,
  loadingMore,
  creating,
  updatingId,
  error,
  statusFilter,
  searchTerm,
  hasMore,
  onCreate,
  onUpdate,
  onRetry,
  onStatusChange,
  onSearchChange,
  onClearFilters,
  onLoadMore,
}: WarehouseTrackingViewProps) => {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WarehouseTrackingEvent | null>(null);

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    enabled: hasMore && !loading && !loadingMore,
    rootMargin: '120px',
  });

  const statusOptions = useMemo(() => WAREHOUSE_TRACKING_STATUSES, []);

  const handleCreate = async (payload: WarehouseTrackingCreateInput) => {
    await onCreate(payload);
    toast({
      title: dictionary.form.title,
      description: dictionary.form.description,
    });
    setCreateOpen(false);
  };

  const handleUpdate = async (input: WarehouseTrackingUpdateInput) => {
    if (!editingEntry) return;
    await onUpdate(editingEntry.id, input);
    toast({
      title: dictionary.form.update,
      description: dictionary.form.description,
    });
    setEditingEntry(null);
  };

  const handleStatusValueChange = (value: string) => {
    if (value === 'all') {
      onStatusChange(null);
    } else {
      onStatusChange(value);
    }
  };

  const renderEntryCard = (entry: WarehouseTrackingEvent) => {
    const statusLabel = dictionary.statusBadges[entry.status] ?? entry.status;
    const updatedLabel = entry.eventTime
      ? dictionary.timeline.updatedAt.replace('{{value}}', formatDateTime(entry.eventTime, lang))
      : null;
    const orderDisplay = entry.orderCode ?? entry.orderId;
    return (
      <Card
        key={entry.id}
        className="border-primary/15 bg-white/60 shadow-sm transition hover:border-primary/40 dark:border-primary/20 dark:bg-zinc-900/40"
      >
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {dictionary.timeline.heading} · {orderDisplay}
            </CardTitle>
            <CardDescription className="text-sm text-zinc-600 dark:text-zinc-300">
              {entry.customerName || dictionary.timeline.customer}: {entry.customerEmail ?? '—'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-primary/15 text-primary-900 dark:bg-primary/20 dark:text-primary-100">
              {statusLabel}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setEditingEntry(entry)}>
              {dictionary.form.update}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
          {updatedLabel && <p>{updatedLabel}</p>}
          <p>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{dictionary.timeline.responsibleCompany}:</span>{' '}
            {entry.responsibleCompany ?? '—'}
          </p>
          <p>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{dictionary.timeline.trackingCode}:</span>{' '}
            {entry.trackingCode ?? '—'}
          </p>
          <p>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{dictionary.timeline.location}:</span>{' '}
            {entry.location ?? '—'}
          </p>
          <p>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{dictionary.timeline.estimatedDelivery}:</span>{' '}
            {formatDate(entry.estimatedDelivery, lang)}
          </p>
          {entry.note && (
            <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
              {dictionary.timeline.note}: {entry.note}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{dictionary.title}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{dictionary.description}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{dictionary.form.title}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            search
          </span>
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={dictionary.filters.searchPlaceholder}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter ?? 'all'} onValueChange={handleStatusValueChange}>
          <SelectTrigger>
            <SelectValue placeholder={dictionary.filters.statusLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{dictionary.filters.statusLabel}</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {dictionary.statusBadges[status] ?? status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={onClearFilters} className="justify-self-start sm:justify-self-end">
          {dictionary.filters.clear}
        </Button>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10">
          <CardHeader>
            <CardTitle className="text-rose-900 dark:text-rose-100">{dictionary.error.title}</CardTitle>
            <CardDescription className="text-rose-700 dark:text-rose-200">{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={onRetry}>{dictionary.error.retry}</Button>
          </CardFooter>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="border-dashed border-zinc-200 bg-white/70 dark:border-zinc-700/60 dark:bg-zinc-900/30">
          <CardHeader>
            <CardTitle>{dictionary.empty.title}</CardTitle>
            <CardDescription>{dictionary.empty.description}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map(renderEntryCard)}
          <div ref={sentinelRef} />
          {loadingMore && <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">{dictionary.loading}</p>}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dictionary.form.title}</DialogTitle>
            <DialogDescription>{dictionary.form.description}</DialogDescription>
          </DialogHeader>
          <WarehouseTrackingForm
            mode="create"
            dictionary={dictionary}
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            submitting={creating}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingEntry)} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dictionary.form.update}</DialogTitle>
            <DialogDescription>{dictionary.form.description}</DialogDescription>
          </DialogHeader>
          {editingEntry && (
            <WarehouseTrackingForm
              mode="update"
              dictionary={dictionary}
              onSubmit={handleUpdate}
              onCancel={() => setEditingEntry(null)}
              defaultValues={{
                orderId: editingEntry.orderId,
                status: editingEntry.status,
                responsibleCompany: editingEntry.responsibleCompany ?? undefined,
                trackingCode: editingEntry.trackingCode ?? undefined,
                location: editingEntry.location ?? undefined,
                note: editingEntry.note ?? undefined,
                estimatedDelivery: editingEntry.estimatedDelivery ?? undefined,
                eventTime: editingEntry.eventTime,
              }}
              submitting={updatingId === editingEntry.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
