'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
import { getCurrentUserProfile } from '@/lib/services/user-service';
import type { Locale } from '@/i18n/config';

interface PaidGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  lang: Locale;
}

type AccessState = 'loading' | 'unauthenticated' | 'denied' | 'granted';

export default function PaidGuard({ children, fallback = null, lang }: PaidGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<AccessState>('loading');

  useEffect(() => {
    let isMounted = true;
    const redirectTarget = encodeURIComponent(`/${lang}/classes`);

    const evaluateAccess = async () => {
      try {
        const { data: { session } } = await getSafeSession();

        if (!session?.user) {
          if (isMounted) {
            setState('unauthenticated');
            router.push(`/${lang}/auth/login?redirect=${redirectTarget}`);
          }
          return;
        }

        const profile = await getCurrentUserProfile();

        if (!isMounted) {
          return;
        }

        if (profile?.pay) {
          setState('granted');
        } else {
          setState('denied');
        }
      } catch (_error) {
        console.error('Error verifying paid access', _error);

        if (isMounted) {
          setState('denied');
        }
      }
    };

    evaluateAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      if (!session?.user) {
        setState('unauthenticated');
        router.push(`/${lang}/auth/login?redirect=${redirectTarget}`);
      } else {
        setState('loading');
        evaluateAccess();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [lang, router]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  if (state === 'granted') {
    return <>{children}</>;
  }

  if (state === 'denied') {
    return <>{fallback}</>;
  }

  // unauthenticated state - redirect handled in effect
  return null;
}
