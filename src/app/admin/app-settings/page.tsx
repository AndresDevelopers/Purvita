'use client';

import { use, useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { AppSettingsForm } from './app-settings-form';
import AdminGuard from '@/components/admin-guard';

interface AdminAppSettingsPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminAppSettingsPage({ searchParams }: AdminAppSettingsPageProps) {
  const params = use(searchParams);
  const lang = params.lang || 'en';

  return (
    <AdminGuard lang={lang} requiredPermission="manage_settings">
      <AdminAppSettingsPageContent lang={lang} />
    </AdminGuard>
  );
}

function AdminAppSettingsPageContent({ lang }: { lang: Locale }) {
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const copy = dictionary?.admin?.appSettings ?? {} as any as any;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-headline text-3xl sm:text-4xl">{copy.pageTitle ?? 'Network growth engine'}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          {copy.pageDescription ?? 'Design the business rules that power commissions, caps, and payout cadence across every level of your network.'}
        </p>
      </div>
      <AppSettingsForm copy={copy} locale={lang} />
    </div>
  );
}
