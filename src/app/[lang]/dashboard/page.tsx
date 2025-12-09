'use client';

import { use } from 'react';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import SubscriptionGuard from '@/components/subscription-guard';
import DashboardContent from './dashboard-content';
import { useAppDictionary } from '@/contexts/locale-content-context';

export default function DashboardPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const dict = useAppDictionary();

  return (
    <AuthGuard lang={lang}>
      <SubscriptionGuard lang={lang} allowWithoutSubscription>
        <DashboardContent lang={lang} dict={dict} />
      </SubscriptionGuard>
    </AuthGuard>
  );
}
