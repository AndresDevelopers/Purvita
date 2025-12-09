'use client';

import { useCallback } from 'react';
import type {
  TeamMessagingEvent,
  TeamMessagingEventBus,
  TeamMessagingObserver,
} from '../domain/events/team-messaging-event-bus';
import { useEffect } from 'react';

const vibrate = (pattern: number | number[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!('vibrate' in navigator)) {
    return;
  }

  navigator.vibrate(pattern);
};

const patternForEvent = (event: TeamMessagingEvent) => {
  switch (event.type) {
    case 'message_sent':
      return [12, 18];
    case 'threads_error':
    case 'message_send_failed':
    case 'mark_read_failed':
      return [20, 24, 20];
    default:
      return null;
  }
};

export const useTeamMessagingHaptics = (eventBus: TeamMessagingEventBus) => {
  const observer = useCallback<TeamMessagingObserver>((event) => {
    const pattern = patternForEvent(event);
    if (pattern) {
      vibrate(pattern);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe(observer);
    return () => unsubscribe();
  }, [eventBus, observer]);
};
