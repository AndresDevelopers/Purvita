'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminDashboardData } from '../domain/entities/admin-dashboard';
import { useAdminDashboardDependencies } from '../context/admin-dashboard-context';
import type { AdminDashboardOverviewRequest } from '../domain/contracts/admin-dashboard-repository';
import { useAuditLogSubscription } from './use-audit-log-subscription';

interface UseAdminDashboardOptions extends AdminDashboardOverviewRequest {
  enabled?: boolean;
}

interface UseAdminDashboardState {
  data: AdminDashboardData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const FALLBACK_DATA: AdminDashboardData = {
  totalUsers: 0,
  totalProducts: 0,
  activeSubscriptions: 0,
  waitlistedSubscriptions: 0,
  totalRevenue: 0,
  totalSubscriptionRevenueCents: 0,
  totalOrderRevenueCents: 0,
  totalWalletBalanceCents: 0,
  totalStock: 0,
  comingSoonSubscribers: 0,
  productStock: [],
  recentUsers: [],
  recentProducts: [],
  topProductSales: [],
  recentActivities: [],
};

export const useAdminDashboardData = ({ enabled = true, recentItemsLimit, withAuditTrail, productsPeriod, activityPeriod }: UseAdminDashboardOptions = {}): UseAdminDashboardState => {
  const { repository, eventBus } = useAdminDashboardDependencies();
  const [state, setState] = useState<Omit<UseAdminDashboardState, 'refresh'>>({
    data: null,
    loading: Boolean(enabled),
    isRefreshing: false,
    error: null,
  });

  const request: AdminDashboardOverviewRequest = useMemo(
    () => ({
      recentItemsLimit,
      withAuditTrail,
      productsPeriod,
      activityPeriod,
    }),
    [recentItemsLimit, withAuditTrail, productsPeriod, activityPeriod],
  );

  const loadDashboard = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!enabled) {
        setState({ data: null, loading: false, isRefreshing: false, error: null });
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: mode === 'initial',
        isRefreshing: mode === 'refresh',
        error: mode === 'initial' ? null : prev.error,
      }));

      eventBus.emit({ type: 'loading' });

      try {
        const data = await repository.getOverview(request);
        setState({ data, loading: false, isRefreshing: false, error: null });
        eventBus.emit({ type: 'loaded', payload: data });
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error('Unknown error');
        setState({ data: FALLBACK_DATA, loading: false, isRefreshing: false, error: normalizedError });
        eventBus.emit({ type: 'error', error: normalizedError });
      }
    },
    [enabled, eventBus, repository, request],
  );

  const refresh = useCallback(async () => {
    await loadDashboard('refresh');
  }, [loadDashboard]);

  const handleRealtimeActivity = useCallback(() => {
    return loadDashboard('refresh');
  }, [loadDashboard]);

  useAuditLogSubscription(enabled ? handleRealtimeActivity : null);

  useEffect(() => {
    loadDashboard('initial');
  }, [loadDashboard]);

  return {
    ...state,
    refresh,
  };
};
