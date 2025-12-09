'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { useAdminGuard } from '../hooks/use-admin-guard';
import { AdminGuardLoadingView } from '../views/admin-guard-loading';

interface AdminGuardControllerProps {
  children: ReactNode;
  lang: Locale;
}

export const AdminGuardController = ({ children, lang }: AdminGuardControllerProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isLoading,
    isAuthenticated,
    profile,
    redirectTo,
    acknowledgeRedirect,
  } = useAdminGuard({ lang });

  // Allow access to login page without authentication
  const isLoginPage = pathname === '/admin/login' || pathname.endsWith('/admin/login');

  useEffect(() => {
    if (!redirectTo || isLoginPage) {
      return;
    }
    router.replace(redirectTo);
    acknowledgeRedirect();
  }, [acknowledgeRedirect, redirectTo, router, isLoginPage]);

  if (isLoading && !isLoginPage) {
    return <AdminGuardLoadingView lang={lang} />;
  }

  // Only block if not authenticated or no profile (permission check is in the hook)
  if (!isAuthenticated || !profile) {
    if (isLoginPage) {
      return <>{children}</>;
    }
    return null;
  }

  return <>{children}</>;
};
