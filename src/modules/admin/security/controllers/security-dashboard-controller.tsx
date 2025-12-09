'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { SecurityDashboardView } from '../views/security-dashboard-view';
import { useSecurityStats } from '../hooks/use-security-stats';

interface SecurityDashboardControllerProps {
  lang: Locale;
}

export const SecurityDashboardController = ({ lang }: SecurityDashboardControllerProps) => {
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const { stats, isLoading } = useSecurityStats();

  // Pass the entire security dictionary
  const securityDict = dict?.admin?.security ?? {};

  return (
    <SecurityDashboardView
      lang={lang}
      securityDict={securityDict}
      stats={stats}
      isLoading={isLoading}
      error={null}
      onRefresh={() => {}}
    />
  );
};

