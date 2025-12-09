import AdminGuard from '@/components/admin-guard';
import type { Locale } from '@/i18n/config';
import { AdminDashboardController } from '@/modules/admin/dashboard/controllers/admin-dashboard-controller';

export const dynamic = 'force-dynamic';

interface AdminDashboardPageProps {
  searchParams?: Promise<{ lang?: Locale }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const lang = (params?.lang ?? 'en') as Locale;

  return (
    <AdminGuard lang={lang} requiredPermission="view_dashboard">
      <AdminDashboardController lang={lang} />
    </AdminGuard>
  );
}
