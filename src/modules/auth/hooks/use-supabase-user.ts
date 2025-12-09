'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSafeSession, supabase } from '@/lib/supabase';

export type SupabaseUserState = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const initialState = {
  user: null as User | null,
  session: null as Session | null,
  isAuthenticated: false,
  isLoading: true,
  error: null as Error | null,
};

export function useSupabaseUser(): SupabaseUserState {
  const [state, setState] = useState(initialState);
  const isMountedRef = useRef(true);

  const applySession = useCallback((session: Session | null, error: Error | null = null) => {
    if (!isMountedRef.current) {
      return;
    }

    setState({
      user: session?.user ?? null,
      session: session ?? null,
      isAuthenticated: Boolean(session?.user),
      isLoading: false,
      error,
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await getSafeSession();

      if (error) {
        throw error;
      }

      applySession(session ?? null);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error('Unknown authentication error');
      applySession(null, error);
    }
  }, [applySession]);

  useEffect(() => {
    isMountedRef.current = true;

    const loadInitialSession = async () => {
      await refresh();
    };

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) {
        return;
      }
      applySession(session ?? null);
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applySession, refresh]);

  return {
    ...state,
    refresh,
  };
}
