'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Component that guards pages to only be accessible in development mode.
 * In production, it will redirect to the home page.
 */
export function DevOnlyGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[DevOnlyGuard] Access denied in production environment');
      router.replace('/');
    }
  }, [router]);

  // In production, don't render anything (will redirect)
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="relative">
      {/* Dev mode banner */}
      <div className="bg-yellow-500 text-yellow-950 px-4 py-2 text-center text-sm font-medium">
        ⚠️ DEVELOPMENT MODE - This page is not accessible in production
      </div>
      {children}
    </div>
  );
}
