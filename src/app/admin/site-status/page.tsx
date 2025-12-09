import type { Locale } from '@/i18n/config';
import { availableLocales, DEFAULT_LOCALE } from '@/i18n/dictionaries';
import { AdminSiteStatusExperience } from '@/modules/site-status/ui/admin-site-status-experience';
import AdminGuard from '@/components/admin-guard';

interface AdminSiteStatusPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

const isSupportedLocale = (value: string | undefined): value is Locale =>
  Boolean(value && availableLocales.includes(value as Locale));

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default async function AdminSiteStatusPage({ searchParams }: AdminSiteStatusPageProps) {
  const params = await searchParams;
  const lang = isSupportedLocale(params?.lang) ? params.lang : DEFAULT_LOCALE;

  return (
    <AdminGuard lang={lang} requiredPermission="manage_settings">
      <AdminSiteStatusExperience lang={lang} />
    </AdminGuard>
  );
}
