'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, getSafeSession } from '@/lib/supabase';
import type { Locale } from '@/i18n/config';
import { getCurrentUserProfile } from '@/lib/services/user-service';

interface AuthGuardProps {
  children: React.ReactNode;
  lang: Locale;
  /**
   * Array of required permissions. User must have at least one of these permissions.
   * If not specified, only authentication is required (no specific permissions).
   * Example: ['manage_users', 'view_analytics']
   */
  requiredPermissions?: string[];
  unauthorizedRedirectPath?: string;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unauthorized';

const AUTH_CONFIRM_DELAY_MS = 1200;
const AUTH_PENDING_MAX_WAIT_MS = 5000;
const SUPABASE_AUTH_PARAM_KEYS = [
  'access_token',
  'refresh_token',
  'token',
  'token_hash',
  'code',
  'type',
  'provider_token',
] as const;

const parseParams = (raw: string): URLSearchParams => {
  const trimmed = raw.startsWith('#') || raw.startsWith('?') ? raw.slice(1) : raw;
  return new URLSearchParams(trimmed);
};

export default function AuthGuard({
  children,
  lang,
  requiredPermissions,
  unauthorizedRedirectPath,
}: AuthGuardProps) {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const authStatusRef = useRef<AuthStatus>('loading');
  const mountedRef = useRef(false);
  const initialSessionHandledRef = useRef(false);
  const redirectInProgressRef = useRef(false);
  const confirmControllerRef = useRef<AbortController | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabaseAuthPendingRef = useRef(false);
  const supabaseAuthFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requiredPermissionsSet = useMemo(() => {
    return new Set(requiredPermissions ?? []);
  }, [requiredPermissions]);

  const supabaseAuthParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        hasParams: false,
        hashParams: new URLSearchParams(),
        searchParams: new URLSearchParams(),
      };
    }

    const searchParams = parseParams(window.location.search);
    const hashParams = parseParams(window.location.hash);

    const hasParams = SUPABASE_AUTH_PARAM_KEYS.some(
      (key) => searchParams.has(key) || hashParams.has(key),
    );

    return { hasParams, hashParams, searchParams };
  }, []);

  const cancelPendingConfirm = useCallback(() => {
    if (confirmControllerRef.current) {
      confirmControllerRef.current.abort();
      confirmControllerRef.current = null;
    }

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
  }, []);

  const clearSupabaseAuthPending = useCallback(() => {
    if (supabaseAuthFallbackTimeoutRef.current) {
      clearTimeout(supabaseAuthFallbackTimeoutRef.current);
      supabaseAuthFallbackTimeoutRef.current = null;
    }
    supabaseAuthPendingRef.current = false;
  }, []);

  const setStatus = useCallback((status: AuthStatus) => {
    if (!mountedRef.current) {
      return;
    }

    authStatusRef.current = status;
    setAuthStatus(status);
  }, []);

  const scrubAuthHashFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!window.location.hash) {
      return;
    }

    const hashParams = parseParams(window.location.hash);
    const containsTokens = SUPABASE_AUTH_PARAM_KEYS.some((key) => hashParams.has(key));

    if (!containsTokens) {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, document.title, cleanUrl);
  }, []);

  const resolvedUnauthorizedRedirectPath = useMemo(() => {
    return unauthorizedRedirectPath ?? `/${lang}/dashboard`;
  }, [lang, unauthorizedRedirectPath]);

  const redirectToUnauthorized = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (redirectInProgressRef.current) {
      return;
    }

    redirectInProgressRef.current = true;
    cancelPendingConfirm();
    clearSupabaseAuthPending();
    router.replace(resolvedUnauthorizedRedirectPath);
  }, [
    cancelPendingConfirm,
    clearSupabaseAuthPending,
    resolvedUnauthorizedRedirectPath,
    router,
  ]);

  const ensureAuthorized = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    // If no permissions are required, just authenticate
    if (requiredPermissionsSet.size === 0) {
      setStatus('authenticated');
      return;
    }

    setStatus('loading');

    try {
      // Verify user profile exists
      const profile = await getCurrentUserProfile();

      if (!mountedRef.current) {
        return;
      }

      if (!profile) {
        setStatus('unauthorized');
        redirectToUnauthorized();
        return;
      }

      // Check if user has required permissions
      try {
        const response = await fetch('/api/check-admin-access', {
          method: 'GET',
          credentials: 'include',
        });

        if (!mountedRef.current) {
          return;
        }

        if (!response.ok) {
          setStatus('unauthorized');
          redirectToUnauthorized();
          return;
        }

        const data = await response.json();
        const userPermissions = data.permissions || [];

        // Check if user has ANY of the required permissions
        const hasRequiredPermission = Array.from(requiredPermissionsSet).some(
          permission => userPermissions.includes(permission)
        );

        if (hasRequiredPermission) {
          setStatus('authenticated');
          return;
        }

        console.warn('AuthGuard: unauthorized permission access attempt', {
          requiredPermissions: Array.from(requiredPermissionsSet),
          userPermissions,
        });

        setStatus('unauthorized');
        redirectToUnauthorized();
      } catch (permError) {
        console.error('Error checking permissions:', permError);
        setStatus('unauthorized');
        redirectToUnauthorized();
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      console.error('Error verifying user authorization:', error);
      setStatus('unauthorized');
      redirectToUnauthorized();
    }
  }, [requiredPermissionsSet, redirectToUnauthorized, setStatus]);

  const markAuthenticated = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    cancelPendingConfirm();
    clearSupabaseAuthPending();
    scrubAuthHashFromUrl();
    redirectInProgressRef.current = false;
    await ensureAuthorized();
  }, [
    cancelPendingConfirm,
    clearSupabaseAuthPending,
    ensureAuthorized,
    scrubAuthHashFromUrl,
  ]);

  const redirectToLogin = useCallback(
    ({ force = false }: { force?: boolean } = {}) => {
      if (!mountedRef.current) {
        return;
      }

      if (!force) {
        if (authStatusRef.current === 'authenticated') {
          return;
        }

        if (redirectInProgressRef.current) {
          return;
        }

        if (supabaseAuthPendingRef.current) {
          return;
        }
      }

      redirectInProgressRef.current = true;
      cancelPendingConfirm();
      clearSupabaseAuthPending();
      // Cookies are managed automatically by @supabase/ssr
      setStatus('unauthenticated');
      router.replace(`/${lang}/auth/login`);
    },
    [cancelPendingConfirm, clearSupabaseAuthPending, lang, router, setStatus],
  );

  const confirmUnauthenticated = useCallback(() => {
    cancelPendingConfirm();
    const controller = new AbortController();
    confirmControllerRef.current = controller;

    const runConfirmation = async () => {
      try {
        const {
          data: { session },
        } = await getSafeSession();

        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }

        if (session?.user) {
          // Cookies are managed automatically by @supabase/ssr
          void markAuthenticated();
          return;
        }

        if (authStatusRef.current === 'authenticated' || supabaseAuthPendingRef.current) {
          return;
        }

        redirectToLogin({ force: true });
      } catch (error) {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }

        console.error('Error confirmando autenticación:', error);

        if (authStatusRef.current === 'authenticated' || supabaseAuthPendingRef.current) {
          return;
        }

        redirectToLogin({ force: true });
      }
    };

    confirmTimeoutRef.current = setTimeout(() => {
      void runConfirmation();
    }, AUTH_CONFIRM_DELAY_MS);
  }, [cancelPendingConfirm, markAuthenticated, redirectToLogin]);

  const checkAuth = useCallback(async () => {
    setStatus('loading');

    try {
      const {
        data: { session },
      } = await getSafeSession();

      if (!mountedRef.current) {
        return;
      }

      if (session?.user) {
        // Cookies are managed automatically by @supabase/ssr
        void markAuthenticated();
        return;
      }

      if (initialSessionHandledRef.current && !supabaseAuthPendingRef.current) {
        redirectToLogin({ force: true });
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      console.error('Error verificando autenticación:', error);

      if (initialSessionHandledRef.current && !supabaseAuthPendingRef.current) {
        redirectToLogin({ force: true });
      }
    }
  }, [markAuthenticated, redirectToLogin, setStatus]);

  useEffect(() => {
    if (!supabaseAuthParams.hasParams) {
      return undefined;
    }

    supabaseAuthPendingRef.current = true;

    if (supabaseAuthFallbackTimeoutRef.current) {
      clearTimeout(supabaseAuthFallbackTimeoutRef.current);
    }

    supabaseAuthFallbackTimeoutRef.current = setTimeout(() => {
      supabaseAuthFallbackTimeoutRef.current = null;
      if (!supabaseAuthPendingRef.current) {
        return;
      }

      supabaseAuthPendingRef.current = false;
      redirectToLogin({ force: true });
    }, AUTH_PENDING_MAX_WAIT_MS);

    const attemptSupabaseSessionFromHash = async () => {
      if (typeof window === 'undefined') {
        return;
      }

      const accessToken = supabaseAuthParams.hashParams.get('access_token');
      const refreshToken = supabaseAuthParams.hashParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        return;
      }

      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          // Cookies are managed automatically by @supabase/ssr
          void markAuthenticated();
        } else {
          clearSupabaseAuthPending();
        }
      } catch (error) {
        console.error('Error establishing Supabase session from auth hash:', error);
        clearSupabaseAuthPending();
      }
    };

    void attemptSupabaseSessionFromHash();

    return () => {
      if (supabaseAuthFallbackTimeoutRef.current) {
        clearTimeout(supabaseAuthFallbackTimeoutRef.current);
        supabaseAuthFallbackTimeoutRef.current = null;
      }
    };
  }, [clearSupabaseAuthPending, markAuthenticated, redirectToLogin, supabaseAuthParams]);

  useEffect(() => {
    mountedRef.current = true;
    initialSessionHandledRef.current = false;
    redirectInProgressRef.current = false;
    setStatus('loading');
    cancelPendingConfirm();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) {
        return;
      }

      switch (event) {
        case 'INITIAL_SESSION':
          initialSessionHandledRef.current = true;
          if (session?.user) {
            // Cookies are managed automatically by @supabase/ssr
            void markAuthenticated();
          } else {
            void confirmUnauthenticated();
          }
          break;
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          if (session?.user) {
            // Cookies are managed automatically by @supabase/ssr
            void markAuthenticated();
          }
          break;
        case 'SIGNED_OUT':
          redirectInProgressRef.current = false;
          // Cookies are managed automatically by @supabase/ssr
          redirectToLogin({ force: true });
          break;
        default:
          break;
      }
    });

    void checkAuth();

    return () => {
      mountedRef.current = false;
      initialSessionHandledRef.current = false;
      redirectInProgressRef.current = false;
      cancelPendingConfirm();
      clearSupabaseAuthPending();
      subscription.unsubscribe();
    };
  }, [
    cancelPendingConfirm,
    checkAuth,
    clearSupabaseAuthPending,
    confirmUnauthenticated,
    lang,
    markAuthenticated,
    redirectToLogin,
    setStatus,
  ]);

  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated' || authStatus === 'unauthorized') {
    return null;
  }

  return <>{children}</>;
}
