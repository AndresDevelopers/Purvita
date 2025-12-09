'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type SubscriptionHandler = (() => void | Promise<void>) | null | undefined;

export const useAuditLogSubscription = (onNewActivity: SubscriptionHandler) => {
  useEffect(() => {
    if (!onNewActivity) {
      return;
    }

    const channel = supabase
      .channel('admin-dashboard-audit-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
        },
        async () => {
          try {
            await onNewActivity();
          } catch (error) {
            console.warn('Audit log subscription handler failed', error);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewActivity]);
};
