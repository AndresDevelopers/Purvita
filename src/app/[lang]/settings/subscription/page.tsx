'use client';

import { use } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import SubscriptionContent from '@/app/[lang]/subscription/subscription-content';

interface SettingsSubscriptionPageProps {
  params: Promise<{
    lang: Locale;
  }>;
}

export default function SettingsSubscriptionPage({ params }: SettingsSubscriptionPageProps) {
  const { lang } = use(params);
  const dict = useAppDictionary();
  const router = useRouter();

  const subscriptionSettingsCopy = dict.settings?.subscriptionPage;

  return (
    <AuthGuard lang={lang}>
      <div className="min-h-screen bg-[#f6f8f6] text-slate-900 dark:bg-[#0b1910] dark:text-slate-100">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            <button
              type="button"
              onClick={() => router.push(`/${lang}/settings`)}
              className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{subscriptionSettingsCopy?.backButton ?? 'Back to settings'}</span>
            </button>

            {subscriptionSettingsCopy?.intro && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {subscriptionSettingsCopy.intro}
              </p>
            )}

            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-8">
              <SubscriptionContent lang={lang} dict={dict} layout="settings" />
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
