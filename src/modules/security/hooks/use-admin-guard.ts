'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { UserProfile } from '@/lib/models/definitions';
import { supabase } from '@/lib/supabase';
import { getCurrentUserProfile } from '@/lib/services/user-service';
import { createSecurityModule } from '../factories/security-module';
import { SentryLogger } from '../../../modules/observability/services/sentry-logger';

interface AdminGuardState {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  redirectTo: string | null;
}

interface UseAdminGuardOptions {
  lang: Locale;
}

interface UseAdminGuardResult extends AdminGuardState {
  acknowledgeRedirect: () => void;
}

const { sessionRepository } = createSecurityModule();

export const useAdminGuard = ({ lang }: UseAdminGuardOptions): UseAdminGuardResult => {
  const [state, setState] = useState<AdminGuardState>({
    isLoading: true,
    isAuthenticated: false,
    profile: null,
    redirectTo: null,
  });

  const acknowledgeRedirect = useCallback(() => {
    setState((prev) => (prev.redirectTo ? { ...prev, redirectTo: null } : prev));
  }, []);

  // ✅ SECURITY: Session timeout implementation
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes (synced with server admin timeout)

    const handleSessionTimeout = async () => {
      await supabase.auth.signOut();
      setState({
        isLoading: false,
        isAuthenticated: false,
        profile: null,
        redirectTo: `/${lang}`,
      });
    };

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleSessionTimeout, INACTIVITY_TIMEOUT);
    };

    // Reset timer on user activity
    const activityEvents = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [lang]);

  useEffect(() => {
    let active = true;

    const evaluateAccess = async () => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const { session } = await sessionRepository.getCurrentSession();
        if (!active) {
          return;
        }

        if (!session?.user) {
          // Si no hay sesión, redirigir a la página principal
          setState({
            isLoading: false,
            isAuthenticated: false,
            profile: null,
            redirectTo: `/${lang}`,
          });
          return;
        }

        const profile = await getCurrentUserProfile();
        if (!active) {
          return;
        }

        if (!profile) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            profile: null,
            redirectTo: `/${lang}`,
          });
          return;
        }

        // Check admin access using RBAC permission system
        try {
          const response = await fetch('/api/check-admin-access', {
            method: 'GET',
            credentials: 'include',
          });

          if (!active) {
            return;
          }

          if (!response.ok) {
            // User doesn't have admin access permission
            setState({
              isLoading: false,
              isAuthenticated: true,
              profile,
              redirectTo: `/${lang}`,
            });
            return;
          }

          const data = await response.json();

          if (!data.hasAccess) {
            // User doesn't have access_admin_panel permission
            setState({
              isLoading: false,
              isAuthenticated: true,
              profile,
              redirectTo: `/${lang}`,
            });
            return;
          }

          // User has admin access
          setState({
            isLoading: false,
            isAuthenticated: true,
            profile,
            redirectTo: null,
          });
        } catch (permError) {
          console.error('Error checking admin permissions:', permError);
          // On permission check error, redirect to home
          setState({
            isLoading: false,
            isAuthenticated: true,
            profile,
            redirectTo: `/${lang}`,
          });
        }
      } catch (error) {
        if (!active) {
          return;
        }
        console.error('Error verifying admin permissions:', error);

        // Log admin permission errors to Sentry
        SentryLogger.captureException(error, {
          module: 'security',
          operation: 'admin_guard_verification',
          tags: {
            error_type: 'admin_permission_error',
          },
          extra: {
            lang,
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
          },
        });

        setState({
          isLoading: false,
          isAuthenticated: false,
          profile: null,
          redirectTo: `/${lang}`,
        });
      }
    };

    evaluateAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        setState({
          isLoading: false,
          isAuthenticated: false,
          profile: null,
          redirectTo: `/${lang}`,
        });
        return;
      }

      if (event === 'SIGNED_IN') {
        evaluateAccess();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [lang]);

  return {
    ...state,
    acknowledgeRedirect,
  };
};
