import type { Locale } from '@/i18n/config';
import { AdminPaymentSettingsController } from '@/modules/payments/controllers/admin-payment-settings-controller';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import { normalizeSubscriptionTestInfo } from '@/modules/payments/utils/subscription-test-info';

type AdminPaysSearchParams = Promise<{ lang?: Locale }>;

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default async function AdminPaysPage({
  searchParams,
}: {
  searchParams: AdminPaysSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const lang = (resolvedSearchParams?.lang as Locale) || 'en';
  const dict = await getLocalizedDictionary(lang);
  const subscriptionTestInfo = normalizeSubscriptionTestInfo(dict.admin.subscriptionTestInfo);
  const paysSection = dict.admin.pays ?? {};

  const copy = {
    heading: dict.admin.paymentGateways.heading,
    description: dict.admin.paymentGateways.description,
    statusLabel: dict.admin.paymentGateways.statusLabel ?? 'Estado',
    activeLabel: dict.admin.paymentGateways.active ?? 'Activo',
    inactiveLabel: dict.admin.paymentGateways.inactive ?? 'Inactivo',
    functionalityLabel: (dict.admin.paymentGateways as any).functionalityLabel ?? 'Funcionalidad',
    modeLabel: (dict.admin.paymentGateways as any).modeLabel ?? 'Modo',
    saveLabel: dict.admin.paymentGateways.save ?? 'Guardar',
    paymentLabel: (dict.admin.paymentGateways as any).paymentLabel ?? 'Recibir Pagos',
    payoutLabel: (dict.admin.paymentGateways as any).payoutLabel ?? 'Realizar Cobros',
    bothLabel: (dict.admin.paymentGateways as any).bothLabel ?? 'Ambos',
    productionLabel: (dict.admin.paymentGateways as any).productionLabel ?? 'Producción',
    testLabel: (dict.admin.paymentGateways as any).testLabel ?? 'Test/Sandbox',
    successTitle: dict.admin.paymentGateways.successTitle ?? 'Éxito',
    errorTitle: dict.admin.paymentGateways.errorTitle ?? 'Error',
    genericErrorMessage: dict.admin.paymentGateways.genericErrorMessage ?? 'Ocurrió un error',
    retryLabel: dict.admin.paymentGateways.retry ?? 'Reintentar',
    // Availability labels
    availabilityLabel: (dict.admin.paymentGateways as any).availabilityLabel ?? 'Disponible en',
    affiliateStoreLabel: (dict.admin.paymentGateways as any).affiliateStoreLabel ?? 'Tienda Afiliado',
    mlmStoreLabel: (dict.admin.paymentGateways as any).mlmStoreLabel ?? 'Tienda MLM',
    mainStoreLabel: (dict.admin.paymentGateways as any).mainStoreLabel ?? 'Tienda Principal',
    paypal: {
      title: dict.admin.paymentGateways.paypal?.title ?? 'PayPal',
      description: dict.admin.paymentGateways.paypal?.description ?? 'Configurar PayPal para pagos y cobros',
      successDescription: dict.admin.paymentGateways.paypal?.successDescription ?? 'Configuración de PayPal actualizada',
    },
    stripe: {
      title: (dict.admin.paymentGateways as any).stripe?.title ?? 'Stripe',
      description: (dict.admin.paymentGateways as any).stripe?.description ?? 'Configurar Stripe para pagos y cobros',
      successDescription: (dict.admin.paymentGateways as any).stripe?.successDescription ?? 'Configuración de Stripe actualizada',
    },
    wallet: {
      title: (dict.admin.paymentGateways as any).wallet?.title ?? 'Billetera Interna',
      description: (dict.admin.paymentGateways as any).wallet?.description ?? 'Permite a los usuarios usar su saldo interno para pagos',
      successDescription: (dict.admin.paymentGateways as any).wallet?.successDescription ?? 'Configuración de billetera actualizada',
    },
    manual: {
      title: (dict.admin.paymentGateways as any).manual?.title ?? 'Depósito Manual',
      description: (dict.admin.paymentGateways as any).manual?.description ?? 'Configurar métodos de depósito manual (USDT, Bitcoin, Transferencia Bancaria, etc.)',
      successDescription: (dict.admin.paymentGateways as any).manual?.successDescription ?? 'Configuración actualizada',
      configureLabel: (dict.admin.paymentGateways as any).manual?.configureLabel ?? 'Configurar Métodos',
      configureHref: '/admin/payment-wallets',
    },
    authorize_net: {
      title: (dict.admin.paymentGateways as any).authorize_net?.title ?? 'Authorize.net',
      description: (dict.admin.paymentGateways as any).authorize_net?.description ?? 'Configurar Authorize.net para pagos con tarjeta de crédito',
      successDescription: (dict.admin.paymentGateways as any).authorize_net?.successDescription ?? 'Configuración de Authorize.net actualizada',
    },
    payoneer: {
      title: (dict.admin.paymentGateways as any).payoneer?.title ?? 'Payoneer',
      description: (dict.admin.paymentGateways as any).payoneer?.description ?? 'Configurar Payoneer para cobros globales',
      successDescription: (dict.admin.paymentGateways as any).payoneer?.successDescription ?? 'Configuración de Payoneer actualizada',
    },
  } as const;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-headline">{(paysSection as any).title ?? 'Pays'}</h1>
        {(paysSection as any).description ? (
          <p className="text-muted-foreground max-w-2xl">{(paysSection as any).description}</p>
        ) : null}
      </div>
      <AdminPaymentSettingsController
        copy={copy}
        subscriptionTestInfo={subscriptionTestInfo}
      />
    </div>
  );
}
