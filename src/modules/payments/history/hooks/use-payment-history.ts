'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaymentHistoryEventBus, PaymentHistoryObserver } from '../domain/events/payment-history-event-bus';
import type { PaymentHistoryEntry, PaymentHistoryFilter, PaymentStatus, ManualPaymentInput } from '../domain/models/payment-history-entry';
import type { PaymentScheduleConfig, PaymentScheduleUpdateInput } from '../domain/models/payment-schedule';
import { PaymentHistoryService } from '../services/payment-history-service';

interface UsePaymentHistoryOptions {
  service: PaymentHistoryService;
  eventBus: PaymentHistoryEventBus;
}

export interface PaymentHistoryState {
  entries: PaymentHistoryEntry[];
  schedule: PaymentScheduleConfig | null;
  loading: boolean;
  error: Error | null;
  isRefreshing: boolean;
  isSubmitting: boolean;
  filter: PaymentHistoryFilter;
}

export interface UsePaymentHistoryResult extends PaymentHistoryState {
  stats: Record<PaymentStatus, number> & { total: number };
  refresh: () => Promise<void>;
  setFilter: (filter: PaymentHistoryFilter) => void;
  markAsPaid: (id: string) => Promise<void>;
  markAsPending: (id: string) => Promise<void>;
  markAsOverdue: (id: string) => Promise<void>;
  addManualPayment: (input: ManualPaymentInput) => Promise<void>;
  updateSchedule: (input: PaymentScheduleUpdateInput) => Promise<void>;
}

const defaultFilter: PaymentHistoryFilter = {};

export const usePaymentHistory = ({ service, eventBus }: UsePaymentHistoryOptions): UsePaymentHistoryResult => {
  const [allEntries, setAllEntries] = useState<PaymentHistoryEntry[]>([]);
  const [schedule, setSchedule] = useState<PaymentScheduleConfig | null>(null);
  const [filter, setFilterState] = useState<PaymentHistoryFilter>(defaultFilter);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadSchedule = useCallback(async () => {
    try {
      const scheduleResult = await service.getSchedule();
      setSchedule(scheduleResult);
    } catch (scheduleError) {
      console.error('[usePaymentHistory] Failed to load schedule configuration:', scheduleError);
      // No propagamos el error del schedule, usamos valores por defecto
    }
  }, [service]);

  const loadHistory = useCallback(async () => {
    try {
      setError(null);
      const data = await service.loadHistory();
      setAllEntries(data);
    } catch (historyError) {
      console.error('[usePaymentHistory] Failed to load history:', historyError);
      setError(historyError as Error);
    }
  }, [service]);

  const initializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setLoading(true);
    await Promise.all([loadSchedule(), loadHistory()]);
    setLoading(false);
  }, [loadHistory, loadSchedule]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const observer: PaymentHistoryObserver = (event) => {
      if (event.type === 'entry_added') {
        setError(null);
        setAllEntries((prev) => [event.entry, ...prev.filter((item) => item.id !== event.entry.id)]);
      }
      if (event.type === 'entry_updated') {
        setError(null);
        setAllEntries((prev) => prev.map((item) => (item.id === event.entry.id ? event.entry : item)));
      }
      if (event.type === 'history_loaded') {
        setError(null);
        setAllEntries(event.entries);
      }
      if (event.type === 'schedule_updated') {
        setError(null);
        setSchedule(event.schedule);
      }
      if (event.type === 'history_error') {
        setError(event.error);
      }
    };

    const unsubscribe = eventBus.subscribe(observer);
    return () => unsubscribe();
  }, [eventBus]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadSchedule(), loadHistory()]);
    setIsRefreshing(false);
  }, [loadHistory, loadSchedule]);

  const handleFilterChange = useCallback((nextFilter: PaymentHistoryFilter) => {
    setFilterState(nextFilter);
  }, []);

  const mutateEntry = useCallback(
    async (id: string, status: PaymentStatus) => {
      try {
        setError(null);
        setIsSubmitting(true);
        await service.updateStatus(id, status);
      } catch (mutationError) {
        setError(mutationError as Error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [service],
  );

  const addManualPayment = useCallback(
    async (input: ManualPaymentInput) => {
      try {
        setError(null);
        setIsSubmitting(true);
        await service.addManualPayment(input);
      } catch (submitError) {
        setError(submitError as Error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [service],
  );

  const updateSchedule = useCallback(
    async (input: PaymentScheduleUpdateInput) => {
      try {
        setError(null);
        setIsSubmitting(true);
        await service.updateSchedule(input);
      } catch (scheduleError) {
        setError(scheduleError as Error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [service],
  );

  const stats = useMemo(() => {
    const base: Record<PaymentStatus, number> = {
      paid: 0,
      pending: 0,
      overdue: 0,
      upcoming: 0,
    };

    for (const entry of allEntries) {
      base[entry.status] += 1;
    }

    return {
      ...base,
      total: allEntries.length,
    };
  }, [allEntries]);

  const entries = useMemo(() => {
    if (!filter.status) {
      return allEntries;
    }
    return allEntries.filter((entry) => entry.status === filter.status);
  }, [allEntries, filter.status]);

  return {
    entries,
    schedule,
    loading,
    error,
    isRefreshing,
    isSubmitting,
    filter,
    stats,
    refresh,
    setFilter: handleFilterChange,
    markAsPaid: useCallback((id: string) => mutateEntry(id, 'paid'), [mutateEntry]),
    markAsPending: useCallback((id: string) => mutateEntry(id, 'pending'), [mutateEntry]),
    markAsOverdue: useCallback((id: string) => mutateEntry(id, 'overdue'), [mutateEntry]),
    addManualPayment,
    updateSchedule,
  };
};
