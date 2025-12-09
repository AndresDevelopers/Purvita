'use client';

import { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { SessionTimeoutProvider } from '@/components/security/session-timeout-provider';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface AffiliateSecurityWrapperProps {
  children: ReactNode;
  timeoutMinutes: number;
  warningMinutes: number;
  lang: Locale;
}

/**
 * Client-side security wrapper for affiliate pages
 * Applies session timeout and other security features
 */
export function AffiliateSecurityWrapper({
  children,
  timeoutMinutes,
  warningMinutes,
  lang,
}: AffiliateSecurityWrapperProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/${lang}/auth/login?timeout=true`);
  };

  return (
    <>
      <SessionTimeoutProvider
        timeoutMinutes={timeoutMinutes}
        warningMinutes={warningMinutes}
        enabled={true}
        onLogout={handleLogout}
      />
      {children}
    </>
  );
}

