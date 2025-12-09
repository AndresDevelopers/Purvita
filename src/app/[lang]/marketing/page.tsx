'use client';

import { use } from 'react';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import MLMGuard from '@/components/mlm-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import MarketingAssets from './marketing-assets';

export default function MarketingPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const dict = useAppDictionary();
  const marketingCopy = dict.marketing ?? {
    title: 'Herramientas de marketing',
    subtitle: 'Accede a recursos listos para compartir y hacer crecer tu marca.',
  };

  return (
    <AuthGuard lang={lang}>
      <MLMGuard lang={lang}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {marketingCopy.title}
              </h1>
              {marketingCopy.subtitle && (
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  {marketingCopy.subtitle}
                </p>
              )}
            </div>

            <MarketingAssets lang={lang} dict={dict} />
          </div>
        </div>
      </MLMGuard>
    </AuthGuard>
  );
}