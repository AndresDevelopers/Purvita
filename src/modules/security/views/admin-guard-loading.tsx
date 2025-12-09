'use client';

import type { Locale } from '@/i18n/config';

interface AdminGuardLoadingViewProps {
  lang: Locale;
}

const copyByLang: Record<Locale, string> = {
  en: 'Verifying administrator permissions…',
  es: 'Verificando permisos de administrador…',
};

export const AdminGuardLoadingView = ({ lang }: AdminGuardLoadingViewProps) => {
  const message = copyByLang[lang] ?? copyByLang.en;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-24 w-24 animate-spin rounded-full border-b-2 border-primary" />
      <p className="text-sm text-background-dark/70 dark:text-background-light/70">{message}</p>
    </div>
  );
};
