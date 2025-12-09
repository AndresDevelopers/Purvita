'use client';

import { useEffect, useCallback } from 'react';
import type {
  AdminBroadcastEvent,
  AdminBroadcastEventBus,
  AdminBroadcastObserver,
} from '../domain/events/admin-broadcast-event-bus';

const vibrate = (pattern: number | number[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!('vibrate' in navigator)) {
    return;
  }

  navigator.vibrate(pattern);
};

const resolvePattern = (event: AdminBroadcastEvent) => {
  switch (event.type) {
    case 'overview_loaded':
      return [8];
    case 'preview_ready':
      return [10, 12];
    case 'broadcast_sent':
      return [18, 12, 18];
    case 'overview_failed':
    case 'preview_failed':
    case 'broadcast_failed':
      return [20, 25, 20];
    default:
      return null;
  }
};

export const useAdminBroadcastHaptics = (eventBus: AdminBroadcastEventBus) => {
  const observer = useCallback<AdminBroadcastObserver>((event: AdminBroadcastEvent) => {
    const pattern = resolvePattern(event);
    if (pattern) {
      vibrate(pattern);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe(observer);
    return () => unsubscribe();
  }, [eventBus, observer]);
};

