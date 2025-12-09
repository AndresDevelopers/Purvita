'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge as _Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { usePaymentProviders } from '@/modules/payments/hooks/use-payment-gateways';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';
import { PaymentService } from '@/modules/payments/services/payment-service';
import type { PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';
import { cn } from '@/lib/utils';

const MIN_AMOUNT = PAYMENT_CONSTANTS.AMOUNTS.MIN_AMOUNT;

const generateRechargeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
};

interface BalanceRechargeProps {
  userId: string | null;
  lang: Locale;
  onPaymentInitiated?: () => void;
}

interface ProviderOption {
  provider: PaymentProvider;
  mode: 'production' | 'test';
  label: string;
}

export function BalanceRecharge({ userId, lang, onPaymentInitiated }: BalanceRechargeProps) {
  const dict = useAppDictionary();
  const rechargeDict = dict.profile?.balanceRecharge;
  const { toast } = useToast();

  const { providers, isLoading: providersLoading, error: providersError, refresh } = usePaymentProviders();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerOptions: ProviderOption[] = useMemo(() => {
    return providers
      .filter((item) => item.provider === 'paypal' || item.provider === 'stripe')
      .map((item) => ({
        provider: item.provider as PaymentProvider,
        mode: item.mode,
        label: item.provider === 'paypal' ? dict.checkout?.paypal ?? 'PayPal' : dict.checkout?.stripe ?? 'Stripe',
      }));
  }, [providers, dict.checkout?.paypal, dict.checkout?.stripe]);

  const formatTemplate = useCallback((template: string | undefined, replacements: Record<string, string>) => {
    if (!template) {
      return undefined;
    }

    return Object.entries(replacements).reduce(
      (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
      template,
    );
  }, []);

  useEffect(() => {
    if (!providersLoading && providerOptions.length > 0) {
      setSelectedProvider((current) => current ?? providerOptions[0]?.provider ?? null);
    }
  }, [providersLoading, providerOptions]);

  const resetForm = useCallback(() => {
    setAmount('');
    setIsSubmitting(false);
    setSelectedProvider(providerOptions[0]?.provider ?? null);
  }, [providerOptions]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    } else if (!providersLoading && providerOptions.length === 0) {
      refresh();
    }
  };

  const formatCurrency = useMemo(
    () =>
      new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
      }),
    [lang],
  );

  const handleSubmit = async () => {
    const amountValue = parseFloat(amount);
    const invalidAmount = Number.isNaN(amountValue) || amountValue < MIN_AMOUNT;

    if (invalidAmount) {
      toast({
        title: rechargeDict?.errors?.invalidAmountTitle ?? 'Invalid amount',
        description:
          formatTemplate(rechargeDict?.errors?.invalidAmountDescription, {
            amount: formatCurrency.format(MIN_AMOUNT),
          }) ?? `Enter at least ${formatCurrency.format(MIN_AMOUNT)} to recharge your balance.`,
        variant: 'destructive',
      });
      return;
    }

    if (!selectedProvider) {
      toast({
        title: rechargeDict?.errors?.noProviderTitle ?? 'Select a payment method',
        description: rechargeDict?.errors?.noProviderDescription ?? 'Choose PayPal or Stripe to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (!userId) {
      toast({
        title: rechargeDict?.errors?.sessionTitle ?? 'Session expired',
        description:
          rechargeDict?.errors?.sessionDescription ??
          'Sign in again to recharge your balance.',
        variant: 'destructive',
      });
      return;
    }

    const providerInfo = providerOptions.find((option) => option.provider === selectedProvider);
    if (!providerInfo) {
      toast({
        title: rechargeDict?.errors?.noProviderTitle ?? 'Select a payment method',
        description: rechargeDict?.errors?.noProviderDescription ?? 'Choose PayPal or Stripe to continue.',
        variant: 'destructive',
      });
      return;
    }

    const rechargeId = generateRechargeId();
    const amountCents = Math.round(amountValue * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS);

    const buildReturnUrl = (status: 'success' | 'cancel') => {
      if (typeof window === 'undefined') {
        return undefined;
      }

      const url = new URL(window.location.href);
      url.searchParams.set('recharge', status);
      url.searchParams.set('provider', selectedProvider);
      url.searchParams.set('amount', amountValue.toFixed(2));
      url.searchParams.set('recharge_id', rechargeId);
      url.searchParams.set('mode', providerInfo.mode);
      return url.toString();
    };

    setIsSubmitting(true);

    try {
      const description =
        rechargeDict?.paymentDescription ?? 'Account balance recharge';

      const paymentResponse = await PaymentService.createPayment(selectedProvider, {
        amount: amountValue,
        currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
        description,
        isTest: providerInfo.mode === 'test',
        originUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        successUrl: buildReturnUrl('success'),
        cancelUrl: buildReturnUrl('cancel'),
        metadata: {
          intent: 'wallet_recharge',
          userId,
          amountCents,
          currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
          providerMode: providerInfo.mode,
          rechargeId,
        },
      });

      const paymentUrl = PaymentService.getPaymentUrl(selectedProvider, paymentResponse);

      if (!paymentUrl) {
        throw new Error('Missing payment URL');
      }

      onPaymentInitiated?.();
      setOpen(false);
      resetForm();

      window.location.href = paymentUrl;
    } catch (error) {
      console.error('Failed to start recharge payment', error);
      toast({
        title: rechargeDict?.errors?.submissionTitle ?? 'Recharge failed',
        description:
          rechargeDict?.errors?.submissionDescription ?? 'We could not start your recharge. Try again shortly.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isActionDisabled =
    providersLoading ||
    isSubmitting ||
    providerOptions.length === 0 ||
    amount.trim() === '' ||
    Number.isNaN(parseFloat(amount));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px] min-w-[180px]">
          {rechargeDict?.triggerLabel ?? 'Recharge balance'}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-6 sm:max-w-[480px]">
        <DialogHeader className="space-y-2">
          <DialogTitle>{rechargeDict?.title ?? 'Recharge your balance'}</DialogTitle>
          <DialogDescription>
            {rechargeDict?.description ?? 'Choose a payment method and the amount to add to your account.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{rechargeDict?.providerLabel ?? 'Payment method'}</Label>
              {providersLoading && (
                <span className="text-xs text-muted-foreground">
                  {rechargeDict?.loadingProviders ?? 'Loading providers…'}
                </span>
              )}
            </div>
            {providerOptions.length > 0 ? (
              <RadioGroup
                value={selectedProvider ?? undefined}
                onValueChange={(value) => setSelectedProvider(value as PaymentProvider)}
                className="grid gap-3"
              >
                {providerOptions.map((option) => (
                  <label
                    key={option.provider}
                    htmlFor={`recharge-${option.provider}`}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-xl border p-4 shadow-sm transition',
                      selectedProvider === option.provider
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-muted-foreground/20 bg-background hover:border-primary/40',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        id={`recharge-${option.provider}`}
                        value={option.provider}
                        className="h-4 w-4"
                      />
                      <span className="font-medium text-base sm:text-lg">{option.label}</span>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
                {providersLoading
                  ? rechargeDict?.loadingProviders ?? 'Loading providers…'
                  : rechargeDict?.noProviders ?? 'No payment providers are available right now.'}
              </div>
            )}
            {providersError && (
              <p className="text-sm text-destructive">
                {rechargeDict?.providerError ?? 'We could not load payment providers. Please try again.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recharge-amount">{rechargeDict?.amountLabel ?? 'Amount'}</Label>
            <Input
              id="recharge-amount"
              type="number"
              min={MIN_AMOUNT}
              step="0.01"
              inputMode="decimal"
              placeholder={rechargeDict?.amountPlaceholder ?? '0.00'}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">
            {formatTemplate(rechargeDict?.amountHelper, {
              amount: formatCurrency.format(MIN_AMOUNT),
            }) ?? `Minimum recharge ${formatCurrency.format(MIN_AMOUNT)}.`}
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
            {rechargeDict?.liveModeNote ??
              'Complete the payment with your selected provider. Your balance updates automatically once the payment is confirmed.'}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="min-h-[44px] sm:min-w-[140px]">
            {rechargeDict?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isActionDisabled}
            className="min-h-[44px] sm:min-w-[160px]"
          >
            {isSubmitting
              ? rechargeDict?.submittingLabel ?? 'Redirecting…'
              : rechargeDict?.submitLabel ?? 'Continue to payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
