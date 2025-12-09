'use client';

import { useCallback } from 'react';
import type { AdminDashboardObserver } from '../domain/events/admin-dashboard-event-bus';
import { useAdminDashboardEvents } from './use-admin-dashboard-events';

const vibrate = (pattern: number | number[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!('vibrate' in navigator)) {
    return;
  }
  navigator.vibrate(pattern);
};

export const useAdminDashboardHaptics = () => {
  const observer = useCallback<AdminDashboardObserver>((event) => {
    if (event.type === 'loaded') {
      vibrate(18);
    }
    if (event.type === 'error') {
      vibrate([12, 24, 12]);
    }
  }, []);

  useAdminDashboardEvents(observer);
};
