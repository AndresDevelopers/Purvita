'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { AdminBroadcastEventBus } from '../domain/events/admin-broadcast-event-bus';
import { useAdminBroadcastHaptics } from '../hooks/use-admin-broadcast-haptics';
import { useAdminBroadcastPage } from '../hooks/use-admin-broadcast-page';
import { AdminBroadcastPageView } from '../views/admin-broadcast-page-view';

interface AdminBroadcastPageControllerProps {
  lang: Locale;
}

export const AdminBroadcastPageController = ({ lang }: AdminBroadcastPageControllerProps) => {
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const eventBus = useMemo(() => new AdminBroadcastEventBus(), []);
  useAdminBroadcastHaptics(eventBus);

  const state = useAdminBroadcastPage(lang, dictionary, eventBus);

  return <AdminBroadcastPageView state={state} />;
};

