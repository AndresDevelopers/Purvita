'use client';

import { useCallback, Suspense, useMemo, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminGuardController } from '@/modules/security/controllers/admin-guard-controller';
import { i18n, type Locale } from '@/i18n/config';
import { AdminSidebarController } from '@/modules/admin/layout/controllers/admin-sidebar-controller';
import { AdminErrorBoundary } from '@/modules/admin/layout/views/admin-error-boundary';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { AdminBreadcrumbs } from '@/modules/admin/layout/views/admin-breadcrumbs';
import { CsrfTokenProvider } from '@/components/security/csrf-token-provider';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen" />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = (searchParams.get('lang') as Locale) || i18n.defaultLocale;
  const { branding } = useSiteBranding();
  const [csrfToken, setCsrfToken] = useState<string>('');

  // Use default app name if branding is not loaded yet
  const appName = branding?.appName || 'PūrVita';
  const dictionary = useMemo(() => getDictionary(lang, appName), [lang, appName]);
  const mobileMenuLabel = dictionary?.admin?.menuLabel ?? 'Menu';

  const handleReset = useCallback(() => {
    router.refresh();
  }, [router]);

  // ✅ SECURITY: Fetch CSRF token on mount for admin operations
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setCsrfToken(data.token);
        }
      } catch (error) {
        console.error('[Admin Layout] Failed to fetch CSRF token:', error);
      }
    };
    fetchCsrfToken();
  }, []);

  return (
    <AdminGuardController lang={lang}>
      {/* ✅ SECURITY: Provide CSRF token to all admin pages */}
      <CsrfTokenProvider token={csrfToken} />
      <SidebarProvider>
        <AdminSidebarController lang={lang} />
        <SidebarInset>
          <div className="min-h-screen bg-background-light/95 px-0 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] transition-colors dark:bg-background-dark">
            <AdminErrorBoundary lang={lang} onReset={handleReset}>
              <div className="md:hidden mb-4">
                <div className="sticky top-0 z-40 -mx-4 flex items-center gap-3 border-b border-primary/10 bg-background-light/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-background-dark shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur dark:border-primary/20 dark:bg-background-dark/90 dark:text-background-light sm:-mx-8 sm:px-8">
                  <SidebarTrigger className="h-11 w-11 rounded-full border border-primary/30 text-primary shadow-sm transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-primary/40" />
                  <span className="text-base font-semibold">{mobileMenuLabel}</span>
                </div>
              </div>
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 sm:px-8">
                <AdminBreadcrumbs lang={lang} />
                <Suspense fallback={<div className="animate-pulse h-32 bg-muted/50 rounded-lg" />}>
                  {children}
                </Suspense>
              </div>
            </AdminErrorBoundary>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AdminGuardController>
  );
}
