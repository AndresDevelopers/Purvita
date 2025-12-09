'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import type { Locale } from '@/i18n/config';
import { getSafeSession } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { usePaymentProviders } from '@/modules/payments/hooks/use-payment-gateways';
import Link from 'next/link';

interface WalletContentProps {
  lang: Locale;
  dict: any;
}

type PayoutProvider = 'stripe' | 'paypal' | 'authorize_net' | 'payoneer';

interface WalletResponse {
  balance: {
    balance_cents: number;
  } | null;
  transactions: Array<{
    id: string;
    delta_cents: number;
    reason: string;
    meta: Record<string, any> | null;
    created_at: string;
  }>;
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
}

export default function WalletContent({ lang, dict }: WalletContentProps) {
  const walletDict = dict.wallet;
  const summaryDict = dict.dashboard?.home?.summary;
  const { toast } = useToast();
  const { providers, isLoading: providersLoading } = usePaymentProviders();

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [authorizeNetLoading, setAuthorizeNetLoading] = useState(false);
  const [payoneerLoading, setPayoneerLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PayoutProvider | null>(null);

  // Form states for Authorize.Net
  const [authorizeNetForm, setAuthorizeNetForm] = useState({
    routingNumber: '',
    accountNumber: '',
    accountHolderName: '',
  });

  // Form state for Payoneer
  const [payoneerPayeeId, setPayoneerPayeeId] = useState('');

  // Referencias para prevenir race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const isConnectingRef = useRef(false);

  const loadWallet = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await getSafeSession();

      if (!session?.user?.id) {
        throw new Error('Missing authenticated user');
      }

      const response = await fetch('/api/wallet/transactions', {
        headers: { 'x-user-id': session.user.id },
        cache: 'no-store',
        signal, // Añadir signal para cancelación
      });

      if (!response.ok) {
        throw new Error('Failed to load wallet data');
      }

      const payload = (await response.json()) as WalletResponse;
      setWallet(payload);
      setError(null);
    } catch (err) {
      // Ignorar errores de cancelación
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Función de recarga con protección contra llamadas múltiples
  const handleReload = useCallback(async () => {
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    await loadWallet(abortControllerRef.current.signal);
  }, [loadWallet]);

  useEffect(() => {
    const controller = new AbortController();
    loadWallet(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadWallet]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Filtrar proveedores que tienen funcionalidad de cobro (payout o both) y son proveedores de payout válidos
  const availableProviderIds = providers
    .filter((item) => {
      // Solo proveedores que soporten payout
      const isPayoutProvider =
        item.provider === 'stripe' || item.provider === 'paypal' ||
        item.provider === 'authorize_net' || item.provider === 'payoneer';

      // Verificar que la funcionalidad incluya cobros (payout o both)
      const supportsPayout = item.functionality === 'payout' || item.functionality === 'both';

      return isPayoutProvider && supportsPayout;
    })
    .map((item) => item.provider as PayoutProvider);

  const configuredProvider = wallet?.payoutAccount?.provider ?? null;

  // Auto-select provider based on configured account or available providers
  useEffect(() => {
    if (configuredProvider) {
      setSelectedProvider(configuredProvider);
      return;
    }
    if (availableProviderIds.length > 0 && !selectedProvider) {
      setSelectedProvider(availableProviderIds[0]);
    }
  }, [configuredProvider, availableProviderIds, selectedProvider]);

  const handleStripeConnect = useCallback(async () => {
    // Prevenir ejecución múltiple
    if (isConnectingRef.current || stripeLoading) {
      return;
    }

    try {
      isConnectingRef.current = true;
      setStripeLoading(true);

      const response = await fetch(`/api/profile/earnings/stripe-connect-oauth?lang=${lang}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('No pudimos iniciar la conexión con Stripe.');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast({
        title: 'Error al conectar Stripe',
        description: error instanceof Error ? error.message : 'No pudimos iniciar la conexión con Stripe.',
        variant: 'destructive',
      });
    } finally {
      setStripeLoading(false);
      isConnectingRef.current = false;
    }
  }, [lang, toast, stripeLoading]);

  const handlePaypalConnect = useCallback(async () => {
    // Prevenir ejecución múltiple
    if (isConnectingRef.current || paypalLoading) {
      return;
    }

    try {
      isConnectingRef.current = true;
      setPaypalLoading(true);

      const response = await fetch(`/api/profile/earnings/paypal-connect-oauth?lang=${lang}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('No pudimos iniciar la conexión con PayPal.');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast({
        title: 'Error al conectar PayPal',
        description: error instanceof Error ? error.message : 'No pudimos iniciar la conexión con PayPal.',
        variant: 'destructive',
      });
    } finally {
      setPaypalLoading(false);
      isConnectingRef.current = false;
    }
  }, [lang, toast, paypalLoading]);

  const handleAuthorizeNetConnect = useCallback(async () => {
    // Prevenir ejecución múltiple
    if (isConnectingRef.current || authorizeNetLoading) {
      return;
    }

    // Validar formulario
    if (!authorizeNetForm.routingNumber || !authorizeNetForm.accountNumber || !authorizeNetForm.accountHolderName) {
      toast({
        title: 'Datos incompletos',
        description: 'Por favor, completa todos los campos del formulario bancario.',
        variant: 'destructive',
      });
      return;
    }

    try {
      isConnectingRef.current = true;
      setAuthorizeNetLoading(true);

      const response = await fetch('/api/profile/earnings/authorize-net-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authorizeNetForm),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No pudimos conectar tu cuenta bancaria.');
      }

      toast({
        title: '¡Cuenta conectada!',
        description: 'Tu cuenta bancaria ha sido vinculada exitosamente para recibir pagos.',
      });

      // Recargar datos de wallet
      await handleReload();
    } catch (error) {
      toast({
        title: 'Error al conectar cuenta bancaria',
        description: error instanceof Error ? error.message : 'No pudimos conectar tu cuenta bancaria.',
        variant: 'destructive',
      });
    } finally {
      setAuthorizeNetLoading(false);
      isConnectingRef.current = false;
    }
  }, [toast, authorizeNetLoading, authorizeNetForm, handleReload]);

  const handlePayoneerConnect = useCallback(async () => {
    // Prevenir ejecución múltiple
    if (isConnectingRef.current || payoneerLoading) {
      return;
    }

    // Validar Payee ID
    if (!payoneerPayeeId.trim()) {
      toast({
        title: 'Datos incompletos',
        description: 'Por favor, ingresa tu Payoneer Payee ID.',
        variant: 'destructive',
      });
      return;
    }

    try {
      isConnectingRef.current = true;
      setPayoneerLoading(true);

      const response = await fetch('/api/profile/earnings/payoneer-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payeeId: payoneerPayeeId.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No pudimos conectar tu cuenta de Payoneer.');
      }

      toast({
        title: '¡Cuenta conectada!',
        description: 'Tu cuenta de Payoneer ha sido vinculada exitosamente para recibir pagos.',
      });

      // Recargar datos de wallet
      await handleReload();
    } catch (error) {
      toast({
        title: 'Error al conectar Payoneer',
        description: error instanceof Error ? error.message : 'No pudimos conectar tu cuenta de Payoneer.',
        variant: 'destructive',
      });
    } finally {
      setPayoneerLoading(false);
      isConnectingRef.current = false;
    }
  }, [toast, payoneerLoading, payoneerPayeeId, handleReload]);

  // Mapeo de nombres de proveedores para UI
  const providerNames: Record<PayoutProvider, string> = {
    stripe: 'Stripe',
    paypal: 'PayPal',
    authorize_net: 'Authorize.Net',
    payoneer: 'Payoneer',
  };

  if (!walletDict || !summaryDict) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#f6f8f6] text-slate-500 dark:bg-[#0b1910] dark:text-slate-300">
        <p>Wallet dictionary copy missing.</p>
      </div>
    );
  }

  const formatCurrency = (value: number, currency = 'USD') =>
    new Intl.NumberFormat(lang, { style: 'currency', currency }).format(value / 100);

  const availableCents = wallet?.networkEarnings?.totalAvailableCents ?? 0;
  const networkCurrency = wallet?.networkEarnings?.currency ?? 'USD';

  return (
    <div className="min-h-screen bg-[#f6f8f6] text-slate-900 dark:bg-[#0b1910] dark:text-slate-100" data-lang={lang}>
      <main className="px-4 py-10 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-8">
          <header className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">{walletDict.title}</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReload}
              disabled={loading}
              className="min-h-[40px] flex-shrink-0"
            >
              {loading ? '⟳' : '↻'}
            </Button>
          </header>

          {/* Saldo Disponible para Retiro */}
          <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-500/20 dark:bg-white/5">
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {walletDict.availableForWithdrawal || 'Saldo Disponible para Retiro'}
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                {formatCurrency(availableCents, networkCurrency)}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {walletDict.withdrawalDescription || 'Este es el dinero que puedes retirar a tus cuentas externas'}
              </p>
            </div>
          </section>

          {/* Métodos de Cobro */}
          {availableProviderIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{walletDict.paymentMethodsTitle || 'Métodos de Cobro'}</CardTitle>
                <CardDescription>
                  {walletDict.paymentMethodsDescription || 'Configura cómo quieres recibir tus retiros. Puedes vincular Stripe o PayPal.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {availableProviderIds.map((provider) => (
                    <Button
                      key={provider}
                      type="button"
                      size="sm"
                      variant={selectedProvider === provider ? 'default' : 'outline'}
                      onClick={() => setSelectedProvider(provider)}
                      disabled={providersLoading}
                    >
                      {providerNames[provider]}
                    </Button>
                  ))}
                </div>

                {selectedProvider === 'stripe' && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {wallet?.payoutAccount?.provider === 'stripe'
                        ? '✓ Tu cuenta de Stripe está conectada y lista para recibir pagos.'
                        : 'Conecta tu cuenta de Stripe para recibir tus retiros automáticamente.'}
                    </p>
                    {wallet?.payoutAccount?.provider === 'stripe' ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Conectado
                        </span>
                        <Link href={`/${lang}/profile/payout-settings`}>
                          <Button type="button" variant="outline" size="sm">
                            Administrar
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <Button
                        onClick={handleStripeConnect}
                        disabled={stripeLoading || loading || isConnectingRef.current}
                        className="w-full sm:w-auto"
                      >
                        {stripeLoading ? 'Conectando…' : 'Conectar Stripe'}
                      </Button>
                    )}
                  </div>
                )}

                {selectedProvider === 'paypal' && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {wallet?.payoutAccount?.provider === 'paypal'
                        ? '✓ Tu cuenta de PayPal está conectada y lista para recibir pagos.'
                        : 'Conecta tu cuenta de PayPal para recibir tus retiros automáticamente.'}
                    </p>
                    {wallet?.payoutAccount?.provider === 'paypal' ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Conectado
                        </span>
                        <Link href={`/${lang}/profile/payout-settings`}>
                          <Button type="button" variant="outline" size="sm">
                            Administrar
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <Button
                        onClick={handlePaypalConnect}
                        disabled={paypalLoading || loading || isConnectingRef.current}
                        className="w-full sm:w-auto"
                      >
                        {paypalLoading ? 'Conectando…' : 'Conectar PayPal'}
                      </Button>
                    )}
                  </div>
                )}

                {selectedProvider === 'authorize_net' && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {wallet?.payoutAccount?.provider === 'authorize_net'
                        ? '✓ Tu cuenta bancaria está conectada y lista para recibir pagos via ACH.'
                        : 'Conecta tu cuenta bancaria para recibir tus retiros automáticamente via ACH (Authorize.Net).'}
                    </p>
                    {wallet?.payoutAccount?.provider === 'authorize_net' ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Conectado
                        </span>
                        <Link href={`/${lang}/profile/payout-settings`}>
                          <Button type="button" variant="outline" size="sm">
                            Administrar
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="routingNumber">Número de Ruta (Routing Number)</Label>
                            <Input
                              id="routingNumber"
                              type="text"
                              maxLength={9}
                              placeholder="123456789"
                              value={authorizeNetForm.routingNumber}
                              onChange={(e) => setAuthorizeNetForm(prev => ({ ...prev, routingNumber: e.target.value.replace(/\D/g, '') }))}
                              disabled={authorizeNetLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accountNumber">Número de Cuenta</Label>
                            <Input
                              id="accountNumber"
                              type="text"
                              maxLength={17}
                              placeholder="1234567890"
                              value={authorizeNetForm.accountNumber}
                              onChange={(e) => setAuthorizeNetForm(prev => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, '') }))}
                              disabled={authorizeNetLoading}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accountHolderName">Nombre del Titular</Label>
                          <Input
                            id="accountHolderName"
                            type="text"
                            maxLength={100}
                            placeholder="Tu nombre completo"
                            value={authorizeNetForm.accountHolderName}
                            onChange={(e) => setAuthorizeNetForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
                            disabled={authorizeNetLoading}
                          />
                        </div>
                        <Button
                          onClick={handleAuthorizeNetConnect}
                          disabled={authorizeNetLoading || loading || isConnectingRef.current}
                          className="w-full sm:w-auto"
                        >
                          {authorizeNetLoading ? 'Conectando…' : 'Conectar Cuenta Bancaria'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {selectedProvider === 'payoneer' && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {wallet?.payoutAccount?.provider === 'payoneer'
                        ? '✓ Tu cuenta de Payoneer está conectada y lista para recibir pagos.'
                        : 'Conecta tu cuenta de Payoneer para recibir tus retiros automáticamente.'}
                    </p>
                    {wallet?.payoutAccount?.provider === 'payoneer' ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Conectado
                        </span>
                        <Link href={`/${lang}/profile/payout-settings`}>
                          <Button type="button" variant="outline" size="sm">
                            Administrar
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="payoneerPayeeId">Payoneer Payee ID</Label>
                          <Input
                            id="payoneerPayeeId"
                            type="text"
                            maxLength={100}
                            placeholder="Tu Payee ID de Payoneer"
                            value={payoneerPayeeId}
                            onChange={(e) => setPayoneerPayeeId(e.target.value)}
                            disabled={payoneerLoading}
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Puedes encontrar tu Payee ID en tu cuenta de Payoneer.
                          </p>
                        </div>
                        <Button
                          onClick={handlePayoneerConnect}
                          disabled={payoneerLoading || loading || isConnectingRef.current}
                          className="w-full sm:w-auto"
                        >
                          {payoneerLoading ? 'Conectando…' : 'Conectar Payoneer'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-white/10">
                <thead className="bg-slate-50 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <tr>
                    <th className="px-6 py-3 font-semibold">{walletDict.table.header.date || 'Fecha'}</th>
                    <th className="px-6 py-3 font-semibold">{walletDict.table.header.method || 'Método'}</th>
                    <th className="px-6 py-3 font-semibold text-right">{walletDict.table.header.amount || 'Monto'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {(() => {
                    // Filtrar SOLO:
                    // 1. Transferencias desde ganancias al wallet (sale_commission)
                    // 2. Retiros a cuentas externas (withdrawal o payout)
                    const relevantTransactions = (wallet?.transactions ?? []).filter((txn) => {
                      return txn.reason === 'sale_commission' ||
                        txn.reason === 'withdrawal' ||
                        txn.reason === 'payout';
                    });

                    if (relevantTransactions.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 text-sm text-slate-500 dark:text-slate-300">
                            {walletDict.table.emptyWithdrawals || 'No hay retiros ni transferencias registrados'}
                          </td>
                        </tr>
                      );
                    }

                    return relevantTransactions.map((txn) => {
                      // Determinar el tipo y método
                      let methodDisplay = 'N/A';

                      if (txn.reason === 'sale_commission') {
                        methodDisplay = 'Transferencia desde Ganancias';
                      } else if (txn.reason === 'withdrawal' || txn.reason === 'payout') {
                        const paymentMethod = txn.meta?.gateway || txn.meta?.provider || txn.meta?.method;
                        methodDisplay = paymentMethod && typeof paymentMethod === 'string'
                          ? `Retiro a ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}`
                          : 'Retiro';
                      }

                      return (
                        <tr key={txn.id} className="bg-white dark:bg-transparent">
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {new Intl.DateTimeFormat(lang, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(txn.created_at))}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {methodDisplay}
                          </td>
                          <td className={`px-6 py-4 text-right font-medium ${txn.delta_cents > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                            }`}>
                            {txn.delta_cents > 0 ? '+' : '-'}{formatCurrency(Math.abs(txn.delta_cents))}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </section>

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {summaryDict.loading}
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              {summaryDict.error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
