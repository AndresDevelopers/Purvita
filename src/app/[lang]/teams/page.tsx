'use client';

import { use } from 'react';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import MLMGuard from '@/components/mlm-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import TeamsContent from './teams-content';

export default function TeamsPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const dict = useAppDictionary();

  return (
    <AuthGuard lang={lang}>
      <MLMGuard lang={lang}>
        <TeamsContent lang={lang} dict={dict} />
      </MLMGuard>
    </AuthGuard>
  );
}
