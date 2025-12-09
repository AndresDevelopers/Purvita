'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamMessagingClientModuleFactory } from '../factories/team-messaging-client-module';
import type { TeamMessageThread } from '../domain/models/team-message';

interface TeamMessagingState {
  threads: TeamMessageThread[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  service: ReturnType<typeof TeamMessagingClientModuleFactory.create>['service'];
  eventBus: ReturnType<typeof TeamMessagingClientModuleFactory.create>['eventBus'];
}

export const useTeamMessagingState = (): TeamMessagingState => {
  const messagingModule = useMemo(() => TeamMessagingClientModuleFactory.create(), []);
  const [threads, setThreads] = useState<TeamMessageThread[]>(messagingModule.service.getSnapshot());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = messagingModule.eventBus.subscribe((event) => {
      if (event.type === 'threads_loading') {
        setLoading(true);
        setError(null);
      }
      if (event.type === 'threads_loaded') {
        setThreads(event.threads);
        setLoading(false);
      }
      if (event.type === 'threads_error') {
        setError(event.error.message);
        setLoading(false);
      }
      if (event.type === 'message_sent') {
        setError(null);
      }
      if (event.type === 'message_send_failed') {
        setError(event.error.message);
      }
    });

    messagingModule.service.loadThreads().catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to load messages');
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [messagingModule]);

  const reload = useCallback(async () => {
    await messagingModule.service.loadThreads();
  }, [messagingModule.service]);

  return {
    threads,
    loading,
    error,
    reload,
    service: messagingModule.service,
    eventBus: messagingModule.eventBus,
  };
};
