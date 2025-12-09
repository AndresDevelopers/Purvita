'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderFulfillmentEventBus } from '../domain/events/order-fulfillment-event-bus';
import {
  type OrderFulfillmentLoadMode,
  type OrderFulfillmentObserver,
} from '../domain/events/order-fulfillment-event-bus';
import type {
  OrderFulfillmentOrder,
  OrderFulfillmentSummary,
} from '../domain/models/order-fulfillment';
import { OrderFulfillmentService } from '../services/order-fulfillment-service';
import { useOrderFulfillmentEvents } from './use-order-fulfillment-events';

interface UseOrderFulfillmentOptions {
  service: OrderFulfillmentService;
  eventBus: OrderFulfillmentEventBus;
}

export interface OrderFulfillmentState {
  orders: OrderFulfillmentOrder[];
  summary: OrderFulfillmentSummary;
  selectedDate: string;
  timezone: string;
  generatedAt: string | null;
  loading: boolean;
  isRefreshing: boolean;
  error: Error | null;
}

export interface UseOrderFulfillmentResult extends OrderFulfillmentState {
  refresh: () => Promise<void>;
  setDate: (date: string) => Promise<void>;
  goToToday: () => Promise<void>;
}

const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);

const emptySummary: OrderFulfillmentSummary = {
  totalOrders: 0,
  totalUnits: 0,
  totalRevenueCents: 0,
  totalShippingCents: 0,
  totalTaxCents: 0,
  totalDiscountCents: 0,
};

const isSameDay = (current: string, next: string) => current === next;

export const useOrderFulfillment = ({ service, eventBus }: UseOrderFulfillmentOptions): UseOrderFulfillmentResult => {
  const todayRef = useRef(getTodayIsoDate());
  const [orders, setOrders] = useState<OrderFulfillmentOrder[]>([]);
  const [summary, setSummary] = useState<OrderFulfillmentSummary>(emptySummary);
  const [selectedDate, setSelectedDate] = useState<string>(todayRef.current);
  const [timezone, setTimezone] = useState('UTC');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleLoading = useCallback((date: string, mode: OrderFulfillmentLoadMode) => {
    setError(null);
    setSelectedDate((prev) => (isSameDay(prev, date) ? prev : date));
    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
  }, []);

  const handleLoaded = useCallback((event: Parameters<OrderFulfillmentObserver>[0]) => {
    if (event.type !== 'orders_loaded') {
      return;
    }
    setOrders(event.snapshot.orders);
    setSummary(event.snapshot.summary);
    setSelectedDate(event.snapshot.date);
    setTimezone(event.snapshot.timezone);
    setGeneratedAt(event.snapshot.generatedAt);
    setLoading(false);
    setIsRefreshing(false);
    setError(null);
  }, []);

  const handleError = useCallback((event: Parameters<OrderFulfillmentObserver>[0]) => {
    if (event.type !== 'orders_error') {
      return;
    }
    setError(event.error);
    if (event.mode === 'refresh') {
      setIsRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  const observer = useMemo<OrderFulfillmentObserver>(() => {
    return (event) => {
      if (event.type === 'orders_loading') {
        handleLoading(event.date, event.mode);
        return;
      }

      if (event.type === 'orders_loaded') {
        handleLoaded(event);
        return;
      }

      if (event.type === 'orders_error') {
        handleError(event);
      }
    };
  }, [handleError, handleLoaded, handleLoading]);

  useOrderFulfillmentEvents(eventBus, observer);

  const runLoad = useCallback(
    async (date: string, mode: OrderFulfillmentLoadMode) => {
      try {
        await service.loadDay(date, mode);
      } catch (loadError) {
        setError(loadError as Error);
      }
    },
    [service],
  );

  const refresh = useCallback(async () => runLoad(selectedDate, 'refresh'), [runLoad, selectedDate]);

  const setDate = useCallback(
    async (date: string) => {
      if (!date) {
        return;
      }
      setSelectedDate(date);
      await runLoad(date, 'change');
    },
    [runLoad],
  );

  const goToToday = useCallback(async () => {
    const today = getTodayIsoDate();
    await setDate(today);
  }, [setDate]);

  useEffect(() => {
    runLoad(todayRef.current, 'initial');
  }, [runLoad]);

  return {
    orders,
    summary,
    selectedDate,
    timezone,
    generatedAt,
    loading,
    isRefreshing,
    error,
    refresh,
    setDate,
    goToToday,
  };
};
