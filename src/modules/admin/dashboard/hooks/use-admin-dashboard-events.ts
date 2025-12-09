'use client';

import { useEffect } from 'react';
import type { AdminDashboardObserver } from '../domain/events/admin-dashboard-event-bus';
import { useAdminDashboardDependencies } from '../context/admin-dashboard-context';

export const useAdminDashboardEvents = (observer: AdminDashboardObserver | null | undefined) => {
  const { eventBus } = useAdminDashboardDependencies();

  useEffect(() => {
    if (!observer) {
      return;
    }
    return eventBus.subscribe(observer);
  }, [eventBus, observer]);
};
