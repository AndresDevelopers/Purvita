import AdminGuard from '@/components/admin-guard';
import type { Locale } from '@/i18n/config';
import { OrderFulfillmentController } from '@/modules/orders/fulfillment/controllers/order-fulfillment-controller';

export const dynamic = 'force-dynamic';

interface OrdersPageProps {
  searchParams?: Promise<{ lang?: Locale }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const lang = (params?.lang ?? 'en') as Locale;

  return (
    <AdminGuard lang={lang} requiredPermission="manage_orders">
      <OrderFulfillmentController lang={lang} />
    </AdminGuard>
  );
}
