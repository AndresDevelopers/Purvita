'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import type { Locale } from '@/i18n/config';

export default function LogoutPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Call logout API
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });

        // Clear local storage
        if (typeof window !== 'undefined') {
          localStorage.clear();
          sessionStorage.clear();
        }

        // Redirect to home
        router.push(`/${lang}`);
        router.refresh();
      } catch (error) {
        console.error('[Logout Page] Error during logout:', error);
        // Still redirect even if there's an error
        router.push(`/${lang}`);
      }
    };

    performLogout();
  }, [lang, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f8f6] dark:bg-[#0b1910]">
      <div className="text-center">
        <div className="mb-4 text-4xl">👋</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logging out...</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Please wait</p>
      </div>
    </div>
  );
}
