import AdminGuard from '@/components/admin-guard';
import type { Locale } from '@/i18n/config';
import { PaymentHistoryController } from '@/modules/payments/history/controllers/payment-history-controller';

export const dynamic = 'force-dynamic';

interface PaymentHistoryPageProps {
  searchParams?: Promise<{ lang?: Locale }>;
}

export default async function PaymentHistoryPage({ searchParams }: PaymentHistoryPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const lang = (params?.lang ?? 'en') as Locale;

  return (
    <AdminGuard lang={lang}>
      <PaymentHistoryController lang={lang} />
    </AdminGuard>
  );
}
