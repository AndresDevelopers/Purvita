'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { i18n, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { AdminLoginForm } from '@/modules/auth/components/admin-login-form';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const lang = (searchParams.get('lang') as Locale) || i18n.defaultLocale;
  const { branding } = useSiteBranding();

  // Use default app name if branding is not loaded yet
  const appName = branding?.appName || 'PūrVita';
  const dictionary = useMemo(() => getDictionary(lang, appName), [lang, appName]);

  const copy = useMemo(
    () => ({
      title: dictionary?.auth?.loginTitle ?? 'Admin Login',
      subtitle: dictionary?.auth?.loginSubtitle ?? 'Sign in to access the admin panel',
      emailLabel: dictionary?.auth?.emailLabel ?? 'Email',
      passwordLabel: dictionary?.auth?.passwordLabel ?? 'Password',
      submitLabel: dictionary?.navigation?.login ?? 'Login',
      submittingLabel: dictionary?.auth?.loggingIn ?? 'Logging in...',
      unexpectedError: dictionary?.errors?.unexpected ?? 'An unexpected error occurred',
    }),
    [dictionary],
  );

  return <AdminLoginForm lang={lang} copy={copy} />;
}
