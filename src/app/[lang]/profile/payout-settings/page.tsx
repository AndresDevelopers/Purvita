'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { getSafeSession } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/utils/admin-csrf-helpers';

interface PayoutSettingsProps {
  params: Promise<{
    lang: Locale;
  }>;
}

type PayoutProvider = 'stripe' | 'paypal' | 'authorize_net' | 'payoneer';

interface SummaryState {
  networkEarnings: {
    totalAvailableCents: number;
    currency: string;
  } | null;
  payoutAccount: {
    provider: PayoutProvider;
    status: 'pending' | 'active' | 'restricted' | 'disabled';
    account_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  wallet: {
    balance_cents: number;
  } | null;
}

const formatUsd = (value: number, locale: Locale, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value / 100);
  } catch (error) {
    console.error('Failed to format currency', error);
    return `$${(value / 100).toFixed(2)}`;
  }
};

const parseAmountToCents = (value: string) => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, '.');
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
};

const applyTemplate = (template: string, tokens: Record<string, string>) => {
  return Object.entries(tokens).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }, template);
};

type ProviderCopy = Partial<{
  tabLabel: string;
  displayName: string;
  helper: string;
  helperMissing: string;
  cta: string;
  loading: string;
  updateCta: string;
  disconnectCta: string;
  disconnecting: string;
  disconnectSuccessTitle: string;
  disconnectSuccessDescription: string;
  disconnectErrorTitle: string;
  disconnectErrorDescription: string;
  errorTitle: string;
  errorDescription: string;
  providerMismatch: string;
  successTitle: string;
  successDescription: string;
  payoutInfo: string;
  transferTitle: string;
  transferDescription: string;
  transferCta: string;
  transferSuccess: string;
  transferError: string;
  transferAmountLabel: string;
  transferAmountPlaceholder: string;
  transferAmountError: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailHelper: string;
  emailError: string;
  emailInvalid: string;
  currentAccountLabel: string;
  autoPayoutInfo: string;
  autoPayoutDisabled: string;
  autoPayoutUnavailable: string;
}>;

export default function PayoutSettingsPage({ params }: PayoutSettingsProps) {
  const { lang } = use(params);
  const dict = useAppDictionary();
  const { toast } = useToast();

  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [autoPayoutStatus, setAutoPayoutStatus] = useState<{
    enabled: boolean;
    eligible: boolean;
    availableCents: number;
    minimumCents: number;
    thresholdCents: number;
    paymentMode: 'manual' | 'automatic';
    payoutAccount: SummaryState['payoutAccount'];
  } | null>(null);
  const [autoPayoutLoading, setAutoPayoutLoading] = useState(false);
  const [autoPayoutThresholdInput, setAutoPayoutThresholdInput] = useState('');
  const [autoPayoutThresholdError, setAutoPayoutThresholdError] = useState<string | null>(null);
  const [autoPayoutThresholdSaving, setAutoPayoutThresholdSaving] = useState(false);

  const networkCurrency = summary?.networkEarnings?.currency ?? 'USD';
  const availableCents = summary?.networkEarnings?.totalAvailableCents ?? 0;

  const formatAmount = useMemo(
    () => (value: number) => formatUsd(value, lang, networkCurrency),
    [lang, networkCurrency],
  );

  const earningsCopy = useMemo(() => dict.profileEarningsSettings ?? {}, [dict.profileEarningsSettings]) as any;
  const providerMessages = earningsCopy.providers ?? ({} as any);
  const stripeCopy: ProviderCopy = providerMessages?.stripe ?? {};
  const stripeDisplayName = stripeCopy?.displayName ?? 'Stripe';
  const autoCopy = useMemo(() => earningsCopy.autoPayout ?? {}, [earningsCopy]);
  const autoPayoutCopy = autoCopy as any;

  // Mapeo de nombres de proveedores para UI
  const providerDisplayNames: Record<PayoutProvider, string> = {
    stripe: 'Stripe',
    paypal: 'PayPal',
    authorize_net: 'Authorize.Net',
    payoneer: 'Payoneer',
  };

  // Obtener el nombre del proveedor conectado
  const connectedProviderName = summary?.payoutAccount?.provider
    ? providerDisplayNames[summary.payoutAccount.provider]
    : stripeDisplayName;

  const fetchAutoPayoutStatus = useCallback(
    async (targetUserId: string) => {
      try {
        const response = await fetch('/api/profile/earnings/auto-payout', {
          headers: {
            'x-user-id': targetUserId,
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          const details = await response.json().catch(() => null);
          const message =
            (details && 'error' in details ? (details as { error?: string }).error : undefined) ??
            'Failed to load auto payout status.';
          throw new Error(message);
        }

        const status = (await response.json()) as typeof autoPayoutStatus;
        setAutoPayoutStatus(status);
      } catch (statusError) {
        console.error('Failed to load auto payout status', statusError);
        setAutoPayoutStatus(null);
      }
    },
    [],
  );

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await getSafeSession();
      const sessionUserId = data.session?.user?.id;

      if (!sessionUserId) {
        throw new Error('Missing authenticated user');
      }

      setUserId(sessionUserId);

      const response = await fetch('/api/profile/summary', {
        headers: {
          'x-user-id': sessionUserId,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[PayoutSettings] API error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to load payout settings');
      }

      const payload = (await response.json()) as SummaryState;
      setSummary({
        networkEarnings: payload.networkEarnings,
        payoutAccount: payload.payoutAccount,
        wallet: payload.wallet,
      });

      if (sessionUserId) {
        await fetchAutoPayoutStatus(sessionUserId);
      } else {
        setAutoPayoutStatus(null);
      }
    } catch (loadError) {
      console.error('Failed to load payout settings', loadError);
      setError(dict.profileEarningsSettings?.loadError ?? 'No pudimos cargar la información de ganancias.');
      setAutoPayoutStatus(null);
    } finally {
      setLoading(false);
    }
  }, [dict.profileEarningsSettings, fetchAutoPayoutStatus]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);


  useEffect(() => {
    if (!autoPayoutStatus) {
      setAutoPayoutThresholdInput('');
      setAutoPayoutThresholdError(null);
      return;
    }

    const normalized = (autoPayoutStatus.thresholdCents / 100).toFixed(2);
    setAutoPayoutThresholdInput(normalized);
  }, [autoPayoutStatus]);


  const handleAutoPayout = useCallback(async () => {
    if (!userId) {
      setError(earningsCopy.sessionError ?? 'Inicia sesión nuevamente para continuar.');
      return;
    }

    try {
      setAutoPayoutLoading(true);

      const response = await fetchWithCsrf('/api/profile/earnings/auto-payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
      });

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const message =
          (details && 'error' in details ? (details as { error?: string }).error : undefined) ??
          'No pudimos procesar el pago automático.';
        throw new Error(message);
      }

      const payload = await response.json();

      if (payload.processed) {
        const amount = formatAmount(payload.amountCents);

        toast({
          title: (autoCopy as any)?.processedTitle ?? 'Pago procesado',
          description:
            (autoCopy as any)?.processedDescription
              ? applyTemplate((autoCopy as any).processedDescription, {
                amount,
                provider: connectedProviderName,
              })
              : `Se procesó un pago de ${amount} a tu cuenta de ${connectedProviderName}. Llegará en aproximadamente 2 días hábiles.`,
        });

        // Recargar el resumen
        await loadSummary();
      } else {
        const thresholdAmount = formatAmount(
          autoPayoutStatus?.thresholdCents ?? autoPayoutStatus?.minimumCents ?? 900,
        );
        const minimumFloorAmount = formatAmount(autoPayoutStatus?.minimumCents ?? 900);

        toast({
          title: (autoCopy as any)?.notProcessedTitle ?? 'Pago no procesado',
          description:
            payload.message ||
            ((autoCopy as any)?.notProcessedDescription
              ? applyTemplate((autoCopy as any).notProcessedDescription, {
                minimum: thresholdAmount,
                threshold: thresholdAmount,
                floor: minimumFloorAmount,
                provider: connectedProviderName,
              })
              : 'No se pudo procesar el pago automático.'),
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to process auto payout', err);
      toast({
        title: (autoCopy as any)?.errorTitle ?? 'Error al procesar pago',
        description:
          (err as any) instanceof Error
            ? (err as any).message
            : (autoCopy as any)?.errorDescription ?? 'No pudimos procesar el pago automático.',
        variant: 'destructive',
      });
    } finally {
      setAutoPayoutLoading(false);
    }
  }, [userId, earningsCopy, autoCopy, autoPayoutStatus, formatAmount, loadSummary, connectedProviderName, toast]);

  const handleAutoPayoutThresholdSave = useCallback(async () => {
    if (!userId) {
      setError(earningsCopy.sessionError ?? 'Inicia sesión nuevamente para continuar.');
      return;
    }

    if (!autoPayoutStatus) {
      return;
    }

    const parsedCents = parseAmountToCents(autoPayoutThresholdInput);

    if (parsedCents === null) {
      setAutoPayoutThresholdError(
        (autoCopy as any)?.thresholdInvalid ?? 'Ingresa un monto válido para el umbral automático.',
      );
      return;
    }

    if (parsedCents < autoPayoutStatus.minimumCents) {
      const message = (autoCopy as any)?.thresholdBelowMinimum
        ? applyTemplate((autoCopy as any).thresholdBelowMinimum, {
          minimum: formatAmount(autoPayoutStatus.minimumCents),
        })
        : `El umbral mínimo es ${formatAmount(autoPayoutStatus.minimumCents)}.`;
      setAutoPayoutThresholdError(message);
      return;
    }

    if (parsedCents === autoPayoutStatus.thresholdCents) {
      toast({
        title: (autoCopy as any)?.thresholdUnchangedTitle ?? 'Umbral sin cambios',
        description:
          (autoCopy as any)?.thresholdUnchangedDescription ??
          'Ese ya es tu umbral actual para pagos automáticos.',
      });
      return;
    }

    try {
      setAutoPayoutThresholdSaving(true);
      setAutoPayoutThresholdError(null);

      const response = await fetchWithCsrf('/api/profile/earnings/auto-payout', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ thresholdCents: parsedCents }),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const message =
          (details && 'error' in details ? (details as { error?: string }).error : undefined) ??
          (autoCopy as any)?.thresholdError ??
          'No pudimos guardar tu umbral automático. Inténtalo de nuevo en unos minutos.';
        setAutoPayoutThresholdError(message);
        toast({
          title: (autoCopy as any)?.thresholdErrorTitle ?? 'No pudimos guardar el umbral',
          description: message,
          variant: 'destructive',
        });
        return;
      }

      const status = (await response.json()) as typeof autoPayoutStatus;
      setAutoPayoutStatus(status);

      const thresholdLabel = formatAmount(parsedCents);

      toast({
        title: (autoCopy as any)?.thresholdSuccessTitle ?? 'Umbral actualizado',
        description:
          (autoCopy as any)?.thresholdSuccessDescription
            ? applyTemplate((autoCopy as any).thresholdSuccessDescription, {
              threshold: thresholdLabel,
            })
            : `Procesaremos pagos automáticos cuando alcances ${thresholdLabel}.`,
      });
    } catch (thresholdError) {
      console.error('Failed to update auto payout threshold', thresholdError);
      const fallbackMessage =
        (thresholdError as any) instanceof Error
          ? (thresholdError as any).message
          : (autoCopy as any)?.thresholdError ?? 'No pudimos guardar tu umbral automático.';
      setAutoPayoutThresholdError(fallbackMessage);
      toast({
        title: (autoCopy as any)?.thresholdErrorTitle ?? 'Error al guardar el umbral',
        description: fallbackMessage,
        variant: 'destructive',
      });
    } finally {
      setAutoPayoutThresholdSaving(false);
    }
  }, [autoCopy, autoPayoutStatus, autoPayoutThresholdInput, earningsCopy, formatAmount, toast, userId]);

  const handleTransfer = useCallback(async () => {
    if (!userId) {
      setTransferError(earningsCopy.sessionError ?? 'Inicia sesión nuevamente para continuar.');
      return;
    }

    const cents = parseAmountToCents(transferAmount);
    if (!cents) {
      setTransferError(earningsCopy.transferInvalid ?? 'Ingresa un monto válido mayor a 0.');
      return;
    }

    if (cents > availableCents) {
      setTransferError(earningsCopy.transferExceeds ?? 'No tienes saldo suficiente para transferir.');
      return;
    }

    try {
      setTransferLoading(true);
      setTransferError(null);

      const response = await fetchWithCsrf('/api/profile/earnings/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ amountCents: cents }),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const message =
          (details && 'error' in details ? (details as { error?: string }).error : undefined) ??
          earningsCopy.transferError ??
          'No pudimos transferir el saldo a tu balance.';
        throw new Error(message);
      }

      const payload = await response.json();
      setSummary((prev) =>
        prev
          ? {
            ...prev,
            networkEarnings: payload.networkEarnings ?? prev.networkEarnings,
            wallet: payload.wallet ?? prev.wallet,
          }
          : prev,
      );
      setTransferAmount('');

      toast({
        title: earningsCopy.transferSuccessTitle ?? 'Transferencia completada',
        description:
          earningsCopy.transferSuccessDescription?.replace(
            '{{amount}}',
            formatAmount(cents),
          ) ??
          `Transferimos ${formatAmount(cents)} a tu saldo personal.`,
      });
    } catch (transferErr) {
      console.error('Failed to transfer network earnings', transferErr);
      const description =
        (transferErr as any) instanceof Error
          ? (transferErr as any).message
          : earningsCopy.transferError ?? 'No pudimos transferir el saldo a tu balance.';
      setTransferError(description);
      toast({
        title: earningsCopy.transferErrorTitle ?? 'Transferencia fallida',
        description,
        variant: 'destructive',
      });
    } finally {
      setTransferLoading(false);
    }
  }, [availableCents, earningsCopy, formatAmount, toast, transferAmount, userId]);


  return (
    <AuthGuard lang={lang}>
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <div className="space-y-2">
            <Button asChild variant="ghost" className="px-0 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              <Link href={`/${lang}/profile`}>
                {dict.profileEarningsSettings?.backToProfile ?? 'Volver al perfil'}
              </Link>
            </Button>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                  {dict.profileEarningsSettings?.title ?? 'Configuración de ganancias'}
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dict.profileEarningsSettings?.description ??
                    'Conecta tu cuenta de Stripe y transfiere tus comisiones a tu saldo personal.'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadSummary}
                disabled={loading}
                className="min-h-[40px] flex-shrink-0"
              >
                {loading ? '⟳' : '↻'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{dict.profileEarningsSettings?.balanceTitle ?? 'Resumen de ganancias'}</CardTitle>
              <CardDescription>
                {dict.profileEarningsSettings?.balanceDescription ??
                  'Consulta cuánto tienes disponible para transferir y tu saldo actual.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dict.profileEarningsSettings?.availableLabel ?? 'Ganancias disponibles'}
                </p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {loading ? '—' : formatAmount(availableCents)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sección de Pago Automático - Solo si tiene una cuenta de pago conectada */}
          {summary?.payoutAccount &&
            (summary.payoutAccount.provider === 'stripe' ||
              summary.payoutAccount.provider === 'paypal' ||
              summary.payoutAccount.provider === 'authorize_net' ||
              summary.payoutAccount.provider === 'payoneer') &&
            summary?.payoutAccount?.status === 'active' &&
            autoPayoutStatus && (
              <Card>
                <CardHeader>
                  <CardTitle>{(autoPayoutCopy as any)?.title ?? 'Pago automático'}</CardTitle>
                  <CardDescription>
                    {(autoPayoutCopy as any)?.threshold
                      ? applyTemplate((autoPayoutCopy as any).threshold, {
                        minimum: formatAmount(autoPayoutStatus.minimumCents),
                        provider: connectedProviderName,
                      })
                      : `Retira tus ganancias automáticamente cuando tengas más de ${formatAmount(autoPayoutStatus.minimumCents)} disponibles.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        {(autoPayoutCopy as any)?.availableLabel ?? 'Disponible para cobro'}
                      </p>
                      <p className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
                        {formatAmount(autoPayoutStatus.availableCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        {(autoPayoutCopy as any)?.thresholdLabel ?? 'Umbral configurado'}
                      </p>
                      <p className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
                        {formatAmount(autoPayoutStatus.thresholdCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        {(autoPayoutCopy as any)?.minimumLabel ?? 'Mínimo permitido'}
                      </p>
                      <p className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
                        {formatAmount(autoPayoutStatus.minimumCents)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="w-full space-y-2 sm:max-w-xs">
                        <label
                          className="text-sm font-medium text-slate-700 dark:text-slate-200"
                          htmlFor="auto-payout-threshold"
                        >
                          {(autoPayoutCopy as any)?.thresholdInputLabel ?? 'Define tu umbral automático'}
                        </label>
                        <Input
                          id="auto-payout-threshold"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={autoPayoutStatus.minimumCents / 100}
                          value={autoPayoutThresholdInput}
                          onChange={(event) => {
                            setAutoPayoutThresholdInput(event.target.value);
                            setAutoPayoutThresholdError(null);
                          }}
                          disabled={autoPayoutThresholdSaving || loading}
                        />
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {(autoPayoutCopy as any)?.thresholdHelper
                            ? applyTemplate((autoPayoutCopy as any).thresholdHelper, {
                              threshold: formatAmount(autoPayoutStatus.thresholdCents),
                              minimum: formatAmount(autoPayoutStatus.minimumCents),
                            })
                            : `Procesaremos un pago cuando tengas al menos ${formatAmount(
                              autoPayoutStatus.thresholdCents,
                            )} disponibles. El mínimo permitido es ${formatAmount(
                              autoPayoutStatus.minimumCents,
                            )}.`}
                        </p>
                        {autoPayoutThresholdError && (
                          <p className="text-sm text-rose-600 dark:text-rose-400">
                            {autoPayoutThresholdError}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={handleAutoPayoutThresholdSave}
                        disabled={autoPayoutThresholdSaving || loading}
                        className="w-full sm:w-auto"
                      >
                        {autoPayoutThresholdSaving
                          ? (autoPayoutCopy as any)?.thresholdSaving ?? 'Guardando…'
                          : (autoPayoutCopy as any)?.thresholdSave ?? 'Guardar umbral'}
                      </Button>
                    </div>
                  </div>

                  {autoPayoutStatus.eligible ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/20">
                        <p className="text-sm text-emerald-800 dark:text-emerald-200">
                          {(autoPayoutCopy as any)?.eligibleMessage
                            ? applyTemplate((autoPayoutCopy as any).eligibleMessage, {
                              provider: connectedProviderName,
                            })
                            : `Tienes saldo suficiente para solicitar un pago automático. El dinero llegará a tu cuenta de ${connectedProviderName} en aproximadamente 2 días hábiles.`}
                        </p>
                      </div>
                      <Button
                        onClick={handleAutoPayout}
                        disabled={autoPayoutLoading || loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                      >
                        {autoPayoutLoading
                          ? (autoPayoutCopy as any)?.processing ?? 'Procesando pago…'
                          : (autoPayoutCopy as any)?.actionCta ?? 'Cobrar ahora'}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/20">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {(autoPayoutCopy as any)?.notEligibleMessage
                          ? applyTemplate((autoPayoutCopy as any).notEligibleMessage, {
                            minimum: formatAmount(autoPayoutStatus.thresholdCents),
                            threshold: formatAmount(autoPayoutStatus.thresholdCents),
                            floor: formatAmount(autoPayoutStatus.minimumCents),
                            current: formatAmount(autoPayoutStatus.availableCents),
                          })
                          : `Necesitas al menos ${formatAmount(
                            autoPayoutStatus.thresholdCents,
                          )} disponibles para solicitar un pago automático. Actualmente tienes ${formatAmount(
                            autoPayoutStatus.availableCents,
                          )}. El mínimo permitido es ${formatAmount(autoPayoutStatus.minimumCents)}.`}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {(autoPayoutCopy as any)?.providerNotice
                        ? applyTemplate((autoPayoutCopy as any).providerNotice, { provider: connectedProviderName })
                        : `Los pagos se procesan usando las credenciales configuradas por el administrador en ${connectedProviderName}.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          <Card>
            <CardHeader>
              <CardTitle>{dict.profileEarningsSettings?.transferTitle ?? 'Transferir ganancias'}</CardTitle>
              <CardDescription>
                {dict.profileEarningsSettings?.transferDescription ??
                  'Elige cuánto deseas mover a tu saldo personal para usarlo dentro de la plataforma.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="transfer-amount">
                  {dict.profileEarningsSettings?.transferAmountLabel ?? 'Monto a transferir'}
                </label>
                <Input
                  id="transfer-amount"
                  inputMode="decimal"
                  value={transferAmount}
                  onChange={(event) => {
                    setTransferAmount(event.target.value);
                    setTransferError(null);
                  }}
                  placeholder={dict.profileEarningsSettings?.transferPlaceholder ?? '0.00'}
                  disabled={loading || transferLoading}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {dict.profileEarningsSettings?.transferHelper?.replace(
                    '{{available}}',
                    formatAmount(availableCents),
                  ) ??
                    `Disponible: ${formatAmount(availableCents)}`}
                </p>
                {transferError && <p className="text-sm text-rose-600 dark:text-rose-400">{transferError}</p>}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleTransfer}
                  disabled={loading || transferLoading || availableCents <= 0}
                  className="w-full sm:w-auto"
                >
                  {transferLoading
                    ? dict.profileEarningsSettings?.transferLoading ?? 'Transfiriendo…'
                    : dict.profileEarningsSettings?.transferCta ?? 'Transferir al saldo'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTransferAmount('');
                    setTransferError(null);
                  }}
                  disabled={transferLoading}
                  className="w-full sm:w-auto"
                >
                  {dict.profileEarningsSettings?.transferReset ?? 'Limpiar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AuthGuard>
  );
}
