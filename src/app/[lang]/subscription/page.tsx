'use client';

import { use } from 'react';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import SubscriptionContent from './subscription-content';

export default function SubscriptionPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const dict = useAppDictionary();

  return (
    <AuthGuard lang={lang}>
      <SubscriptionContent lang={lang} dict={dict} />
    </AuthGuard>
  );
}
