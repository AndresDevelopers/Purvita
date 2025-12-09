import { Metadata } from 'next';
import AdminGuard from '@/components/admin-guard';
import type { Locale } from '@/i18n/config';
import { SecurityDashboardController } from '@/modules/admin/security/controllers/security-dashboard-controller';

export const metadata: Metadata = {
  title: 'Security Dashboard - Admin',
  description: 'Real-time security monitoring and management',
};

interface PageProps {
  params: Promise<{ lang?: string }>;
}

export default async function SecurityDashboardPage({ params }: PageProps) {
  const { lang } = await params;
  const locale = (lang as Locale) || 'en';

  return (
    <AdminGuard lang={locale} requiredPermission="manage_security">
      <SecurityDashboardController lang={locale} />
    </AdminGuard>
  );
}
