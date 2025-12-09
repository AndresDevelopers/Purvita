'use client';

import { use } from 'react';
import type { Locale } from '@/i18n/config';
import { AdminBroadcastPageController } from '@/modules/admin/messages/controllers/admin-broadcast-page-controller';
import AdminGuard from '@/components/admin-guard';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: Locale }>;
}) {
  const params = use(searchParams);
  const lang = params.lang || 'en';

  return (
    <AdminGuard lang={lang} requiredPermission="manage_content">
      <AdminBroadcastPageController lang={lang} />
    </AdminGuard>
  );
}

