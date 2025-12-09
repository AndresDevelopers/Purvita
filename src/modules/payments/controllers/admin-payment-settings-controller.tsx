'use client';

import { useEffect } from 'react';
import { PaymentMethodToggleCard } from '../views/payment-method-toggle-card';
import { usePaymentGatewaySettings } from '../hooks/use-payment-gateways';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Wallet, Building2, DollarSign } from 'lucide-react';
import type { SubscriptionTestInfo } from '../domain/models/subscription-test-info';

interface PaymentMethodCopy {
  title: string;
  description: string;
  successDescription: string;
  configureLabel?: string;
  configureHref?: string;
}

interface AdminPaymentSettingsCopy {
  heading: string;
  description: string;
  statusLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  functionalityLabel: string;
  modeLabel: string;
  saveLabel: string;
  paymentLabel: string;
  payoutLabel: string;
  bothLabel: string;
  productionLabel: string;
  testLabel: string;
  successTitle: string;
  errorTitle: string;
  genericErrorMessage: string;
  retryLabel: string;
  // Availability labels
  availabilityLabel?: string;
  affiliateStoreLabel?: string;
  mlmStoreLabel?: string;
  mainStoreLabel?: string;
  paypal: PaymentMethodCopy;
  stripe: PaymentMethodCopy;
  wallet: PaymentMethodCopy;
  manual: PaymentMethodCopy;
  authorize_net: PaymentMethodCopy;
  payoneer: PaymentMethodCopy;
}

interface AdminPaymentSettingsControllerProps {
  copy: AdminPaymentSettingsCopy;
  subscriptionTestInfo?: SubscriptionTestInfo;
}

export function AdminPaymentSettingsController({
  copy,
  subscriptionTestInfo: _subscriptionTestInfo,
}: AdminPaymentSettingsControllerProps) {
  const { settings, isLoading, error, update, isSaving } = usePaymentGatewaySettings();
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({
        title: copy.errorTitle,
        description: (error as any).message || copy.genericErrorMessage,
        variant: 'destructive',
      });
    }
  }, [error, toast, copy.errorTitle, copy.genericErrorMessage]);

  const handleSave = async (
    provider: 'paypal' | 'stripe' | 'wallet' | 'manual' | 'authorize_net' | 'payoneer',
    data: {
      active: boolean;
      functionality: 'payment' | 'payout' | 'both';
      mode: 'production' | 'test';
      availableOnAffiliateCheckout: boolean;
      availableOnMlmCheckout: boolean;
      availableOnMainStore: boolean;
    },
    successDescription: string
  ) => {
    await update({
      provider,
      status: data.active ? 'active' : 'inactive',
      functionality: data.functionality,
      mode: data.mode,
      availableOnAffiliateCheckout: data.availableOnAffiliateCheckout,
      availableOnMlmCheckout: data.availableOnMlmCheckout,
      availableOnMainStore: data.availableOnMainStore,
    });
    toast({
      title: copy.successTitle,
      description: successDescription,
    });
  };

  const paypalSettings = settings.find((item) => item.provider === 'paypal');
  const stripeSettings = settings.find((item) => item.provider === 'stripe');
  const walletSettings = settings.find((item) => item.provider === 'wallet');
  const manualSettings = settings.find((item) => item.provider === 'manual');
  const authorizeNetSettings = settings.find((item) => item.provider === 'authorize_net');
  const payoneerSettings = settings.find((item) => item.provider === 'payoneer');

  if (isLoading && settings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
          <p className="text-muted-foreground mt-2">{copy.description}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        <p className="text-muted-foreground mt-2">{copy.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* PayPal */}
        <PaymentMethodToggleCard
          provider="paypal"
          title={copy.paypal.title}
          description={copy.paypal.description}
          icon={<DollarSign className="h-8 w-8 text-blue-600" />}
          initialActive={paypalSettings?.status === 'active'}
          initialFunctionality={(paypalSettings?.functionality as 'payment' | 'payout' | 'both') || 'payment'}
          initialAvailability={{
            availableOnAffiliateCheckout: paypalSettings?.availableOnAffiliateCheckout ?? true,
            availableOnMlmCheckout: paypalSettings?.availableOnMlmCheckout ?? true,
            availableOnMainStore: paypalSettings?.availableOnMainStore ?? true,
          }}
          loading={isLoading && !paypalSettings}
          isSaving={isSaving}
          onSave={(data) => handleSave('paypal', data, copy.paypal.successDescription)}
          statusLabel={copy.statusLabel}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
          functionalityLabel={copy.functionalityLabel}
          saveLabel={copy.saveLabel}
          paymentLabel={copy.paymentLabel}
          payoutLabel={copy.payoutLabel}
          bothLabel={copy.bothLabel}
          availabilityLabel={copy.availabilityLabel}
          affiliateStoreLabel={copy.affiliateStoreLabel}
          mlmStoreLabel={copy.mlmStoreLabel}
          mainStoreLabel={copy.mainStoreLabel}
          showFunctionalitySelector={true}
        />

        {/* Stripe */}
        <PaymentMethodToggleCard
          provider="stripe"
          title={copy.stripe.title}
          description={copy.stripe.description}
          icon={<CreditCard className="h-8 w-8 text-purple-600" />}
          initialActive={stripeSettings?.status === 'active'}
          initialFunctionality={(stripeSettings?.functionality as 'payment' | 'payout' | 'both') || 'payment'}
          initialAvailability={{
            availableOnAffiliateCheckout: stripeSettings?.availableOnAffiliateCheckout ?? true,
            availableOnMlmCheckout: stripeSettings?.availableOnMlmCheckout ?? true,
            availableOnMainStore: stripeSettings?.availableOnMainStore ?? true,
          }}
          loading={isLoading && !stripeSettings}
          isSaving={isSaving}
          onSave={(data) => handleSave('stripe', data, copy.stripe.successDescription)}
          statusLabel={copy.statusLabel}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
          functionalityLabel={copy.functionalityLabel}
          saveLabel={copy.saveLabel}
          paymentLabel={copy.paymentLabel}
          payoutLabel={copy.payoutLabel}
          bothLabel={copy.bothLabel}
          availabilityLabel={copy.availabilityLabel}
          affiliateStoreLabel={copy.affiliateStoreLabel}
          mlmStoreLabel={copy.mlmStoreLabel}
          mainStoreLabel={copy.mainStoreLabel}
          showFunctionalitySelector={true}
        />

        {/* Authorize.net */}
        <PaymentMethodToggleCard
          provider="authorize_net"
          title={copy.authorize_net.title}
          description={copy.authorize_net.description}
          icon={<CreditCard className="h-8 w-8 text-cyan-600" />}
          initialActive={authorizeNetSettings?.status === 'active'}
          initialFunctionality={(authorizeNetSettings?.functionality as 'payment' | 'payout' | 'both') || 'payment'}
          initialAvailability={{
            availableOnAffiliateCheckout: authorizeNetSettings?.availableOnAffiliateCheckout ?? true,
            availableOnMlmCheckout: authorizeNetSettings?.availableOnMlmCheckout ?? true,
            availableOnMainStore: authorizeNetSettings?.availableOnMainStore ?? true,
          }}
          loading={isLoading && !authorizeNetSettings}
          isSaving={isSaving}
          onSave={(data) => handleSave('authorize_net', data, copy.authorize_net.successDescription)}
          statusLabel={copy.statusLabel}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
          functionalityLabel={copy.functionalityLabel}
          saveLabel={copy.saveLabel}
          paymentLabel={copy.paymentLabel}
          payoutLabel={copy.payoutLabel}
          bothLabel={copy.bothLabel}
          availabilityLabel={copy.availabilityLabel}
          affiliateStoreLabel={copy.affiliateStoreLabel}
          mlmStoreLabel={copy.mlmStoreLabel}
          mainStoreLabel={copy.mainStoreLabel}
          showFunctionalitySelector={true}
        />

        {/* Payoneer */}
        <PaymentMethodToggleCard
          provider="payoneer"
          title={copy.payoneer.title}
          description={copy.payoneer.description}
          icon={<DollarSign className="h-8 w-8 text-orange-500" />}
          initialActive={payoneerSettings?.status === 'active'}
          initialFunctionality={(payoneerSettings?.functionality as 'payment' | 'payout' | 'both') || 'payout'}
          initialAvailability={{
            availableOnAffiliateCheckout: payoneerSettings?.availableOnAffiliateCheckout ?? true,
            availableOnMlmCheckout: payoneerSettings?.availableOnMlmCheckout ?? true,
            availableOnMainStore: payoneerSettings?.availableOnMainStore ?? true,
          }}
          loading={isLoading && !payoneerSettings}
          isSaving={isSaving}
          onSave={(data) => handleSave('payoneer', data, copy.payoneer.successDescription)}
          statusLabel={copy.statusLabel}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
          functionalityLabel={copy.functionalityLabel}
          saveLabel={copy.saveLabel}
          paymentLabel={copy.paymentLabel}
          payoutLabel={copy.payoutLabel}
          bothLabel={copy.bothLabel}
          availabilityLabel={copy.availabilityLabel}
          affiliateStoreLabel={copy.affiliateStoreLabel}
          mlmStoreLabel={copy.mlmStoreLabel}
          mainStoreLabel={copy.mainStoreLabel}
          showFunctionalitySelector={true}
        />

        {/* Wallet */}
        <PaymentMethodToggleCard
          provider="wallet"
          title={copy.wallet.title}
          description={copy.wallet.description}
          icon={<Wallet className="h-8 w-8 text-green-600" />}
          initialActive={walletSettings?.status === 'active'}
          initialFunctionality={(walletSettings?.functionality as 'payment' | 'payout' | 'both') || 'payment'}
          initialAvailability={{
            availableOnAffiliateCheckout: walletSettings?.availableOnAffiliateCheckout ?? true,
            availableOnMlmCheckout: walletSettings?.availableOnMlmCheckout ?? true,
            availableOnMainStore: walletSettings?.availableOnMainStore ?? true,
          }}
          loading={isLoading && !walletSettings}
          isSaving={isSaving}
          onSave={(data) => handleSave('wallet', data, copy.wallet.successDescription)}
          statusLabel={copy.statusLabel}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
          functionalityLabel={copy.functionalityLabel}
          saveLabel={copy.saveLabel}
          paymentLabel={copy.paymentLabel}
          payoutLabel={copy.payoutLabel}
          bothLabel={copy.bothLabel}
          availabilityLabel={copy.availabilityLabel}
          affiliateStoreLabel={copy.affiliateStoreLabel}
          mlmStoreLabel={copy.mlmStoreLabel}
          mainStoreLabel={copy.mainStoreLabel}
          showFunctionalitySelector={true}
        />

        {/* Manual Deposit */}
        <PaymentMethodToggleCard
          provider="manual"
          title={copy.manual.title}
          description={copy.manual.description}
          icon={<Building2 className="h-8 w-8 text-orange-600" />}
          initialActive={manualSettings?.status === 'active'}
          initialFunctionality={(manualSettings?.functionality as 'payment' | 'payout' | 'both') || 'payment'}
          initialAvailability={{
            availableOnAffiliateCheckout: manualSettings?.availableOnAffiliateCheckout ?? true,
            availableOnMlmCheckout: manualSettings?.availableOnMlmCheckout ?? true,
            availableOnMainStore: manualSettings?.availableOnMainStore ?? true,
          }}
          loading={isLoading && !manualSettings}
          isSaving={isSaving}
          onSave={(data) => handleSave('manual', data, copy.manual.successDescription)}
          statusLabel={copy.statusLabel}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
          functionalityLabel={copy.functionalityLabel}
          saveLabel={copy.saveLabel}
          paymentLabel={copy.paymentLabel}
          payoutLabel={copy.payoutLabel}
          bothLabel={copy.bothLabel}
          availabilityLabel={copy.availabilityLabel}
          affiliateStoreLabel={copy.affiliateStoreLabel}
          mlmStoreLabel={copy.mlmStoreLabel}
          mainStoreLabel={copy.mainStoreLabel}
          configureLabel={copy.manual.configureLabel}
          configureHref={copy.manual.configureHref || '/admin/payment-wallets'}
          showFunctionalitySelector={false}
        />
      </div>
    </div>
  );
}

