'use client';

import { use, useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { WarehouseTrackingController } from '@/modules/orders/warehouse/controllers/warehouse-tracking-controller';
import AdminGuard from '@/components/admin-guard';

export const dynamic = 'force-dynamic';

interface AdminBodegaPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

export default function AdminBodegaPage({ searchParams }: AdminBodegaPageProps) {
  const params = use(searchParams);
  const lang = params.lang || 'en';
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const copy = dictionary?.admin?.warehouse ?? dictionary?.admin?.orders;

  if (!copy) {
    return null;
  }

  return (
    <AdminGuard lang={lang} requiredPermission="manage_products">
      <WarehouseTrackingController dictionary={copy} lang={lang} />
    </AdminGuard>
  );
}
