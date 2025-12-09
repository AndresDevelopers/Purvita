'use client';

import { use, useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { TutorialsForm } from './tutorials-form';
import AdminGuard from '@/components/admin-guard';

interface AdminTutorialsPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminTutorialsPage({ searchParams }: AdminTutorialsPageProps) {
  const params = use(searchParams);
  const lang = params.lang || 'en';
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const copy = dictionary?.admin?.tutorials ?? {} as any as any;

  return (
    <AdminGuard lang={lang} requiredPermission="manage_content">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-headline text-3xl sm:text-4xl">{copy.title ?? 'Tutorial Management'}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {copy.description ?? 'Create and manage onboarding tutorials that guide new users through the platform.'}
          </p>
        </div>
        <TutorialsForm copy={copy} />
      </div>
    </AdminGuard>
  );
}