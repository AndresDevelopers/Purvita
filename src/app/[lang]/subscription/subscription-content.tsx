'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { getSafeSession } from '@/lib/supabase';
import { getPlans } from '@/lib/services/plan-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePaymentProviders } from '@/modules/payments/hooks/use-payment-gateways';
import { PaymentService } from '@/modules/payments/services/payment-service';
import {
  PaymentFlowService,
  type SubscriptionCheckoutResponse,
} from '@/modules/payments/services/payment-flow-service';
import type { PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';
import { getWalletMetadata } from '@/modules/payments/utils/payment-provider-metadata';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSearchParams } from 'next/navigation';
import { SubscriptionPaymentHandler } from '@/modules/payments/components/subscription-payment-handler';
import { SubscriptionReturnHandler } from '@/modules/payments/components/subscription-return-handler';
import { PaymentReturnUrlService } from '@/modules/payments/services/payment-return-url-service';
import type { SubscriptionInvoice } from '@/modules/subscription/invoices/domain/types';

interface SubscriptionContentProps {
  lang: Locale;
  dict: any;
  layout?: 'standalone' | 'settings';
}

interface SummaryResponse {
  subscription: {
    status: string;
    current_period_end: string | null;
    cancel_at_period_end?: boolean;
    gateway?: string | null;
  } | null;
}

const statusMap: Record<string, 'active' | 'past_due' | 'unpaid' | 'canceled'> = {
  active: 'active',
  past_due: 'past_due',
  unpaid: 'unpaid',
  canceled: 'canceled',
};

export default function SubscriptionContent({ lang, dict, layout = 'standalone' }: SubscriptionContentProps) {
  const subscriptionDict = dict.subscriptionManagement;
  const summaryDict = dict.dashboard?.home?.summary;
  const invoiceHistoryDict = subscriptionDict?.invoiceHistory;
  const searchParams = useSearchParams();

  const isStandaloneLayout = layout === 'standalone';

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<{ id: string; price: number; name: string } | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showArchivedInvoices, setShowArchivedInvoices] = useState(false);
  const [archivingInvoices, setArchivingInvoices] = useState(false);
  const [unarchivingInvoices, setUnarchivingInvoices] = useState(false);
  const [invoiceActionSuccess, setInvoiceActionSuccess] = useState<string | null>(null);
  const [invoiceActionError, setInvoiceActionError] = useState<string | null>(null);
  const [invoiceViewer, setInvoiceViewer] = useState<{ invoiceId: string; html: string } | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

  const { providers: allProviders, isLoading: providersLoading, error: providersError, refresh } = usePaymentProviders();

  // Filtrar proveedores que tienen funcionalidad de pago (payment o both) para suscripciones
  const providers = useMemo(() => {
    return allProviders.filter(p => {
      const supportsPayment = p.functionality === 'payment' || p.functionality === 'both';
      return supportsPayment;
    });
  }, [allProviders]);

  // Get payment return parameters
  const paymentStatus = searchParams?.get('payment_status') || searchParams?.get('status');
  const paymentToken = searchParams?.get('token') || searchParams?.get('order_id');
  const paymentPlanId = searchParams?.get('plan') || searchParams?.get('plan_id');
  const paymentSessionId = searchParams?.get('session_id');
  const originUrlParam = searchParams?.get('origin_url');

  // Decode origin URL if present (from new payment result system)
  const decodedOriginUrl = originUrlParam ? PaymentReturnUrlService.decodeOriginUrl(originUrlParam) : null;

  const formatCurrency = useMemo(
    () =>
      new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
      }),
    [lang],
  );

  // Optimized: Single useEffect to load all subscription data in parallel
  useEffect(() => {
    let ignore = false;

    const initializeSubscription = async () => {
      try {
        setLoading(true);

        // Execute session and plans in parallel to avoid N+1 problem
        const [sessionResult, plansResult] = await Promise.all([
          getSafeSession(),
          getPlans().catch(err => {
            console.error('Failed to fetch plan price:', err);
            return [];
          })
        ]);

        if (ignore) return;

        const session = sessionResult.data.session;
        if (!session?.user?.id) {
          throw new Error('Missing authenticated user');
        }

        const userId = session.user.id;
        setUserId(userId);

        // Set plan details - prioritize default plan, fallback to lowest price
        if (plansResult.length > 0) {
          const defaultPlan = plansResult.find((plan: any) => plan.is_default === true);
          const selectedPlan = defaultPlan || plansResult.reduce((min, plan) => (plan.price < min.price ? plan : min), plansResult[0]);
          setPlanDetails({ id: selectedPlan.id, price: selectedPlan.price, name: selectedPlan.name ?? 'Plan' });
        } else {
          setPlanDetails(null);
        }

        // Load summary and invoices in parallel
        const [summaryRes, invoicesRes] = await Promise.all([
          fetch('/api/dashboard/summary', {
            cache: 'no-store',
            credentials: 'same-origin', // Include cookies for authentication
          }),
          fetch('/api/subscription/invoices?includeArchived=true', { cache: 'no-store' }).catch(err => {
            console.error('[SubscriptionContent] Failed to load invoices', err);
            return null;
          })
        ]);

        if (!summaryRes.ok) {
          throw new Error('Failed to load subscription status');
        }

        const summaryPayload = (await summaryRes.json()) as SummaryResponse;

        if (!ignore) {
          setSummary(summaryPayload);
          setError(null);

          // Set invoices if loaded successfully
          if (invoicesRes && invoicesRes.ok) {
            const invoicesPayload = (await invoicesRes.json()) as { invoices?: SubscriptionInvoice[] };
            setInvoices(invoicesPayload.invoices ?? []);
            setSelectedInvoices([]);
            setInvoiceError(null);
          } else {
            setInvoiceError(invoiceHistoryDict?.loadError ?? 'Unable to load invoices');
          }
          setInvoiceLoading(false);
        }
      } catch (error) {
        if (!ignore) {
          const message = (error as any) instanceof Error ? (error as any).message : 'Unknown error';
          setError(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    initializeSubscription();

    return () => {
      ignore = true;
    };
  }, [invoiceHistoryDict?.loadError]);

  // Set default provider when providers and summary are loaded
  // Prioritize: current subscription gateway > first available provider
  useEffect(() => {
    if (!providersLoading && providers.length > 0 && summary !== null) {
      // Use current subscription gateway if available and enabled
      const currentGateway = summary?.subscription?.gateway as PaymentProvider | undefined;
      if (currentGateway && providers.some(p => p.provider === currentGateway)) {
        setSelectedProvider(currentGateway);
      } else {
        setSelectedProvider(providers[0]?.provider as PaymentProvider);
      }
    }
  }, [providers, providersLoading, summary]);

  // Separate function for manual summary refresh
  const loadSummary = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/summary', {
        headers: {
          'x-user-id': userId,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load subscription status');
      }

      const payload = (await response.json()) as SummaryResponse;
      setSummary(payload);
      setError(null);
    } catch (error) {
      const message = (error as any) instanceof Error ? (error as any).message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Separate function for manual invoice refresh
  const loadInvoices = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setInvoiceLoading(true);
      setInvoiceError(null);
      const response = await fetch('/api/subscription/invoices?includeArchived=true', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(invoiceHistoryDict?.loadError ?? 'Unable to load invoices');
      }

      const payload = (await response.json()) as { invoices?: SubscriptionInvoice[] };
      setInvoices(payload.invoices ?? []);
      setSelectedInvoices([]);
    } catch (err) {
      console.error('[SubscriptionContent] Failed to load invoices', err);
      const message =
        (err as any) instanceof Error
          ? (err as any).message
          : invoiceHistoryDict?.loadError ?? 'Unable to load invoices';
      setInvoiceError(message);
    } finally {
      setInvoiceLoading(false);
    }
  }, [invoiceHistoryDict?.loadError, userId]);

  // All hooks must be called before any conditional returns
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [lang],
  );

  const filteredInvoices = useMemo(() => {
    const normalizedQuery = invoiceQuery.trim().toLowerCase();
    const multiplier = PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS;

    return invoices
      .filter((invoice) => (showArchivedInvoices ? invoice.archived : !invoice.archived))
      .filter((invoice) => {
        if (!normalizedQuery) {
          return true;
        }

        const amount = formatCurrency.format(invoice.amount_cents / multiplier);
        const fields = [
          invoice.id,
          invoice.status,
          invoice.gateway,
          invoice.gateway_ref,
          invoice.period_end ?? '',
          amount,
          dateFormatter.format(new Date(invoice.created_at)),
        ];

        return fields.some((value) => value && value.toString().toLowerCase().includes(normalizedQuery));
      });
  }, [dateFormatter, formatCurrency, invoiceQuery, invoices, showArchivedInvoices]);

  const archivedInvoicesCount = useMemo(
    () => invoices.filter((invoice) => invoice.archived).length,
    [invoices],
  );

  const filteredInvoiceIds = useMemo(() => filteredInvoices.map((invoice) => invoice.id), [filteredInvoices]);

  // Description text without price - price will only be shown for active subscriptions
  const descriptionText = useMemo(() => {
    if (!subscriptionDict?.description) return '';
    // Remove price placeholders from description for users without active subscription
    // Price will be shown separately only when user has an active subscription
    return subscriptionDict.description
      .replace(/\s*\$\d+(\.\d{2})?\s*/g, ' ')
      .replace(/\s*\{\{price\}\}\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, [subscriptionDict?.description]);

  // Conditional returns after all hooks
  if (!subscriptionDict || !summaryDict) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#f6f8f6] text-slate-500 dark:bg-[#0b1910] dark:text-slate-300">
        <p>Subscription dictionary copy missing.</p>
      </div>
    );
  }

  const subscriptionStatus = summary?.subscription?.status ?? 'unpaid';
  const statusKey = statusMap[subscriptionStatus] ?? 'unpaid';
  const statusLabel = subscriptionDict.statuses[statusKey];
  const isCancellationPending = Boolean(summary?.subscription?.cancel_at_period_end);

  const formattedPeriodEnd = summary?.subscription?.current_period_end
    ? dateFormatter.format(new Date(summary.subscription.current_period_end))
    : null;

  const nextCharge = formattedPeriodEnd ?? '—';

  const planPrice = planDetails?.price ?? null;
  const planPriceCents =
    typeof planPrice === 'number' ? Math.round(planPrice * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS) : null;

  const handleOpenDialog = () => {
    setCheckoutError(null);
    setCheckoutSuccess(null);
    setCancelError(null);
    setCancelSuccess(null);

    if (!userId) {
      setCheckoutError(subscriptionDict.paymentDialog?.sessionError ?? 'Sign in again to continue.');
      return;
    }

    if (!providersLoading && providers.length === 0) {
      setCheckoutError(subscriptionDict.paymentDialog?.noProviders ?? 'No payment methods available.');
      refresh();
      return;
    }

    setDialogError(null);
    setIsPaymentDialogOpen(true);
  };

  const selectedProviderInfo = selectedProvider
    ? providers.find((provider) => provider.provider === selectedProvider)
    : undefined;
  const selectedProviderMode = selectedProviderInfo?.mode ?? 'production';
  const isSelectedProviderTest = selectedProviderMode === 'test';
  const _selectedProviderTestInfo =
    selectedProvider && isSelectedProviderTest
      ? PaymentService.getTestInfo(selectedProvider)
      : [];

  const walletMetadata = selectedProviderInfo ? getWalletMetadata(selectedProviderInfo) : null;
  const walletInsufficient =
    selectedProvider === 'wallet' && planPriceCents !== null && walletMetadata
      ? walletMetadata.walletBalanceCents < planPriceCents
      : false;

  const handleCancelSubscription = async () => {
    if (!userId) {
      setCancelError(subscriptionDict.manage?.cancelError ?? 'Unable to cancel right now.');
      setIsCancelDialogOpen(false);
      return;
    }

    const activeThroughOnRequest = formattedPeriodEnd;

    setCancelLoading(true);
    setCancelError(null);

    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: lang }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Cancellation failed');
      }

      const data = (await response.json()) as { canceled?: boolean; alreadyCanceled?: boolean };
      await loadSummary();

      const buildMessage = (
        withDate: string | undefined,
        withoutDate: string | undefined,
        fallback: string,
      ): string => {
        if (activeThroughOnRequest) {
          return withDate ? withDate.replace('{{date}}', activeThroughOnRequest) : withoutDate ?? fallback;
        }
        return withoutDate ?? withDate ?? fallback;
      };

      const genericSuccessFallback =
        subscriptionDict.manage?.cancelSuccessFallback ??
        'Automatic renewals are disabled. You will keep access for the time you already paid.';
      const genericAlreadyFallback =
        subscriptionDict.manage?.cancelAlreadyFallback ??
        'Automatic renewals were already disabled for this subscription.';

      if (data.alreadyCanceled || isCancellationPending) {
        const message = buildMessage(
          subscriptionDict.manage?.cancelAlready,
          subscriptionDict.manage?.cancelAlreadyNoDate,
          genericAlreadyFallback,
        );
        setCancelSuccess(message);
      } else {
        const message = buildMessage(
          subscriptionDict.manage?.cancelSuccess,
          subscriptionDict.manage?.cancelSuccessNoDate,
          genericSuccessFallback,
        );
        setCancelSuccess(message);
      }
    } catch (_error) {
      console.error('Failed to cancel subscription', error);
      const message =
        (error as any) instanceof Error ? (error as any).message : subscriptionDict.manage?.cancelError ?? 'Unable to cancel right now.';
      setCancelError(message);
    } finally {
      setCancelLoading(false);
      setIsCancelDialogOpen(false);
    }
  };

  const handleDialogConfirm = async () => {
    if (!userId || !planDetails) {
      setDialogError(subscriptionDict.paymentDialog?.planUnavailable ?? 'No subscription plan available.');
      return;
    }

    if (!selectedProvider) {
      setDialogError(subscriptionDict.paymentDialog?.providerError ?? 'Select a payment method to continue.');
      return;
    }

    if (walletInsufficient) {
      setDialogError(
        subscriptionDict.paymentDialog?.walletInsufficient ??
        'Your balance is not enough to activate the subscription.',
      );
      return;
    }

    setDialogLoading(true);
    setDialogError(null);

    try {
      // Check if user has an active subscription (update payment method flow)
      const hasActiveSubscription = summary?.subscription?.status === 'active' || summary?.subscription?.status === 'past_due';

      if (hasActiveSubscription) {

        // For Wallet, we can update directly without redirect
        if (selectedProvider === 'wallet') {
          // ✅ SECURITY: Fetch CSRF token before making update payment method request
          const csrfResponse = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include',
          });

          if (!csrfResponse.ok) {
            throw new Error('Failed to obtain CSRF token. Please refresh the page and try again.');
          }

          const { token: walletCsrfToken } = await csrfResponse.json();

          const response = await fetch('/api/subscription/update-payment-method', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': walletCsrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({
              provider: 'wallet',
              setAsDefault: true,
            }),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? 'Failed to update payment method');
          }

          await response.json();

          setIsPaymentDialogOpen(false);
          await loadSummary();
          setCheckoutSuccess(
            subscriptionDict.paymentDialog?.updateSuccess ??
            'Payment method updated successfully. It will be used for future renewals.'
          );
          return;
        }

        // For Stripe and PayPal, fall through to checkout flow to collect payment details
      }

      // SUBSCRIPTION FLOW (new or update payment method)
      const isUpdatingPaymentMethod = hasActiveSubscription && selectedProvider !== 'wallet';

      // ✅ SECURITY: Fetch CSRF token before making subscription checkout request
      const csrfResponse = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });

      if (!csrfResponse.ok) {
        throw new Error('Failed to obtain CSRF token. Please refresh the page and try again.');
      }

      const { token: csrfToken } = await csrfResponse.json();

      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          locale: lang,
          planId: planDetails.id,
          provider: selectedProvider,
          providerMode: selectedProviderMode,
          originUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          updatePaymentMethod: isUpdatingPaymentMethod,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Checkout initiation failed');
      }

      const data = (await response.json()) as SubscriptionCheckoutResponse;
      const paymentResult = PaymentFlowService.normalizeSubscriptionResponse(selectedProvider, data);

      if (paymentResult.status === 'completed') {
        setIsPaymentDialogOpen(false);
        await loadSummary();
        const amountLabel = planPrice !== null ? formatCurrency.format(planPrice) : '';
        const successTemplate = subscriptionDict.paymentDialog?.walletSuccess ??
          'Wallet payment completed and your membership is active.';
        setCheckoutSuccess(
          successTemplate && amountLabel ? successTemplate.replace('{{amount}}', amountLabel) : successTemplate,
        );
        return;
      }

      if (paymentResult.redirectUrl) {
        window.location.href = paymentResult.redirectUrl;
        return;
      }
      setDialogError(subscriptionDict.paymentDialog?.missingRedirect ?? 'Missing payment redirect URL.');
    } catch (submitError) {
      const message =
        (submitError as any) instanceof Error
          ? (submitError as any).message
          : subscriptionDict.paymentDialog?.genericError ?? 'Unable to start checkout.';
      setDialogError(message);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    setSelectedInvoices((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, invoiceId]));
      }
      return prev.filter((id) => id !== invoiceId);
    });
  };

  const handleSelectAllInvoices = (checked: boolean, invoiceIds: string[]) => {
    if (checked) {
      setSelectedInvoices(invoiceIds);
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleArchiveInvoices = async () => {
    if (!userId || selectedInvoices.length === 0) {
      return;
    }

    try {
      setArchivingInvoices(true);
      setInvoiceActionError(null);
      setInvoiceActionSuccess(null);
      const response = await fetch('/api/subscription/invoices/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: selectedInvoices }),
      });

      if (!response.ok) {
        throw new Error(invoiceHistoryDict?.archiveError ?? 'Unable to archive invoices');
      }

      const successMessage =
        invoiceHistoryDict?.archiveSuccess?.replace('{{count}}', `${selectedInvoices.length}`) ??
        `Archived ${selectedInvoices.length} invoice${selectedInvoices.length > 1 ? 's' : ''}.`;
      setInvoiceActionSuccess(successMessage);
      setSelectedInvoices([]);
      await loadInvoices();
    } catch (err) {
      console.error('[SubscriptionContent] Failed to archive invoices', err);
      const message =
        (err as any) instanceof Error
          ? (err as any).message
          : invoiceHistoryDict?.archiveError ?? 'Unable to archive invoices';
      setInvoiceActionError(message);
    } finally {
      setArchivingInvoices(false);
    }
  };

  const handleUnarchiveInvoices = async () => {
    if (!userId || selectedInvoices.length === 0) {
      return;
    }

    try {
      setUnarchivingInvoices(true);
      setInvoiceActionError(null);
      setInvoiceActionSuccess(null);
      const response = await fetch('/api/subscription/invoices/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: selectedInvoices }),
      });

      if (!response.ok) {
        throw new Error(invoiceHistoryDict?.unarchiveError ?? 'Unable to unarchive invoices');
      }

      const successMessage =
        invoiceHistoryDict?.unarchiveSuccess?.replace('{{count}}', `${selectedInvoices.length}`) ??
        `Unarchived ${selectedInvoices.length} invoice${selectedInvoices.length > 1 ? 's' : ''}.`;
      setInvoiceActionSuccess(successMessage);
      setSelectedInvoices([]);
      await loadInvoices();
    } catch (err) {
      console.error('[SubscriptionContent] Failed to unarchive invoices', err);
      const message =
        (err as any) instanceof Error
          ? (err as any).message
          : invoiceHistoryDict?.unarchiveError ?? 'Unable to unarchive invoices';
      setInvoiceActionError(message);
    } finally {
      setUnarchivingInvoices(false);
    }
  };

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      setLoadingInvoiceId(invoiceId);
      setInvoiceActionError(null);
      const response = await fetch(`/api/subscription/invoices/${invoiceId}/invoice`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(invoiceHistoryDict?.invoiceErrorDescription ?? 'Unable to load invoice');
      }

      const html = await response.text();
      setInvoiceViewer({ invoiceId, html });
    } catch (err) {
      console.error('[SubscriptionContent] Failed to load invoice HTML', err);
      const message =
        (err as any) instanceof Error
          ? (err as any).message
          : invoiceHistoryDict?.invoiceErrorDescription ?? 'Unable to load invoice';
      setInvoiceActionError(message);
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleInvoiceViewerChange = (open: boolean) => {
    if (!open) {
      setInvoiceViewer(null);
    }
  };

  const canManage = statusKey === 'active' || statusKey === 'past_due';
  const canCancel = canManage && !isCancellationPending;

  // Description with price - only shown for users with active subscription
  const descriptionWithPrice = (() => {
    if (!subscriptionDict?.description || !planPrice) return descriptionText;
    const formattedPrice = `$${planPrice.toFixed(2)}`;
    return subscriptionDict.description
      .replace(/\$34(\.00)?/g, formattedPrice)
      .replace(/\{\{price\}\}/g, formattedPrice);
  })();

  const invoiceStatusLabels = invoiceHistoryDict?.statuses ?? {
    paid: 'Paid',
    failed: 'Failed',
    refunded: 'Refunded',
  };

  const invoiceMethodLabels: Record<string, string> = {
    stripe: invoiceHistoryDict?.methods?.stripe ?? 'Stripe',
    paypal: invoiceHistoryDict?.methods?.paypal ?? 'PayPal',
    wallet: invoiceHistoryDict?.methods?.wallet ?? 'Wallet balance',
  };

  const invoiceStatusStyles: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
    refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
  };

  const isAllInvoicesSelected =
    filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length;
  const isInvoicesIndeterminate =
    selectedInvoices.length > 0 && selectedInvoices.length < filteredInvoices.length;

  const formatInvoiceDate = (value: string) => {
    try {
      return dateFormatter.format(new Date(value));
    } catch (_error) {
      console.error('[SubscriptionContent] Failed to format invoice date', error);
      return value;
    }
  };

  const formatPeriodEnd = (value: string | null) => {
    if (!value) {
      return invoiceHistoryDict?.periodEndEmpty ?? '—';
    }

    return formatInvoiceDate(value);
  };

  const headerSection = (
    <section className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{subscriptionDict.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {canManage ? descriptionWithPrice : descriptionText}
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
    </section>
  );

  const statusSection = (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{subscriptionDict.statusLabel}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{statusLabel}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {(isCancellationPending ? subscriptionDict.activeThroughLabel : subscriptionDict.nextCharge) ??
              subscriptionDict.nextCharge}
            : {nextCharge}
          </p>
          {isCancellationPending && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
              {formattedPeriodEnd
                ? (subscriptionDict.manage?.pendingCancellation
                  ? subscriptionDict.manage.pendingCancellation.replace('{{date}}', formattedPeriodEnd)
                  : subscriptionDict.manage?.pendingCancellationNoDate) ??
                subscriptionDict.manage?.pendingCancellationFallback ??
                'Automatic renewals are disabled. Your access remains active until your current period ends.'
                : subscriptionDict.manage?.pendingCancellationNoDate ??
                subscriptionDict.manage?.pendingCancellationFallback ??
                'Automatic renewals are disabled. Your access remains active until your current period ends.'}
            </p>
          )}
        </div>
        {canManage ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={handleOpenDialog}
              disabled={!userId || providersLoading}
              className="min-h-[44px]"
            >
              {subscriptionDict.manage?.updateButton ?? 'Update payment method'}
            </Button>
            <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canCancel}
                  className="min-h-[44px] border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-400/60 dark:text-rose-300 dark:hover:bg-rose-400/10"
                >
                  {canCancel
                    ? subscriptionDict.manage?.cancelButton ?? 'Cancel subscription'
                    : subscriptionDict.manage?.cancelDisabledLabel ?? 'Automatic renewals disabled'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{subscriptionDict.manage?.dialog?.title ?? 'Cancel subscription?'}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {subscriptionDict.manage?.dialog?.description
                      ??
                      "We'll stop future charges right away and you'll keep access until the end of your current billing period."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={cancelLoading}>
                    {subscriptionDict.manage?.dialog?.cancel ?? 'Keep subscription'}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    disabled={cancelLoading}
                    className="bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600"
                  >
                    {cancelLoading
                      ? subscriptionDict.paymentDialog?.confirmLoading ?? 'Processing…'
                      : subscriptionDict.manage?.dialog?.confirm ?? 'Yes, cancel it'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleOpenDialog}
            disabled={!userId || providersLoading}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            {subscriptionDict.activateButton}
          </button>
        )}
      </div>
      {checkoutError && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{checkoutError}</p>
      )}
      {checkoutSuccess && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-300">{checkoutSuccess}</p>
      )}
      {cancelError && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{cancelError}</p>
      )}
      {cancelSuccess && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-300">{cancelSuccess}</p>
      )}
      {canManage && subscriptionDict.manage?.sectionDescription && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{subscriptionDict.manage.sectionDescription}</p>
      )}
    </section>
  );

  const loadingSection =
    loading && summaryDict ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        {summaryDict.loading}
      </div>
    ) : null;

  const errorSection =
    error && !loading && summaryDict ? (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        {summaryDict.error}
      </div>
    ) : null;

  const dialogSection = (
    <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {canManage
              ? (subscriptionDict.paymentDialog?.updateTitle ?? 'Update payment method')
              : (subscriptionDict.paymentDialog?.title ?? 'Select a payment method')}
          </DialogTitle>
          <DialogDescription>
            {canManage
              ? (subscriptionDict.paymentDialog?.updateDescription ?? 'Choose a new payment method for future automatic renewals. You will not be charged now.')
              : (subscriptionDict.paymentDialog?.description ?? 'Choose how you want to activate your subscription.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {providersError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              {subscriptionDict.paymentDialog?.providerLoadError ?? 'Unable to load payment methods.'}
            </p>
          )}

          {providersLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {subscriptionDict.paymentDialog?.loading ?? 'Loading payment methods…'}
            </p>
          ) : providers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {subscriptionDict.paymentDialog?.noProviders ?? 'No payment methods available right now.'}
            </p>
          ) : (
            <RadioGroup
              value={selectedProvider ?? undefined}
              onValueChange={(value) => setSelectedProvider(value as PaymentProvider)}
              className="space-y-3"
            >
              {providers.map((provider) => {
                const providerId = provider.provider as PaymentProvider;
                const walletMeta = getWalletMetadata(provider);
                const providerLabel =
                  provider.provider === 'paypal'
                    ? subscriptionDict.paymentDialog?.paypalLabel ?? 'PayPal'
                    : provider.provider === 'stripe'
                      ? subscriptionDict.paymentDialog?.stripeLabel ?? 'Stripe'
                      : subscriptionDict.paymentDialog?.walletLabel ?? 'Wallet balance';
                const _providerTestMode = provider.mode === 'test';
                const walletBalanceLabel = walletMeta
                  ? formatCurrency.format(walletMeta.walletBalanceCents / PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS)
                  : null;
                const providerWalletInsufficient =
                  providerId === 'wallet' && planPriceCents !== null && walletMeta
                    ? walletMeta.walletBalanceCents < planPriceCents
                    : false;

                return (
                  <Label
                    key={providerId}
                    className="flex cursor-pointer flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-500 has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-emerald-500 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={providerId} id={`subscription-provider-${providerId}`} />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{providerLabel}</span>
                      </div>
                      {walletBalanceLabel && (
                        <span className="text-xs text-slate-500 dark:text-slate-300">
                          {subscriptionDict.paymentDialog?.walletBalanceLabel
                            ? subscriptionDict.paymentDialog.walletBalanceLabel.replace('{{amount}}', walletBalanceLabel)
                            : walletBalanceLabel}
                        </span>
                      )}
                    </div>
                    {providerWalletInsufficient && (
                      <p className="text-xs text-rose-600 dark:text-rose-300">
                        {subscriptionDict.paymentDialog?.walletInsufficient ??
                          'Your balance is not enough to activate the subscription.'}
                      </p>
                    )}
                  </Label>
                );
              })}
            </RadioGroup>
          )}

          {dialogError && <p className="text-sm text-rose-600 dark:text-rose-300">{dialogError}</p>}
        </div>

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={dialogLoading}>
            {subscriptionDict.paymentDialog?.cancel ?? 'Cancel'}
          </Button>
          <Button type="button" onClick={handleDialogConfirm} disabled={dialogLoading || providersLoading}>
            {dialogLoading
              ? subscriptionDict.paymentDialog?.confirmLoading ?? 'Processing…'
              : canManage
                ? (subscriptionDict.paymentDialog?.updateConfirm ?? 'Update payment method')
                : (subscriptionDict.paymentDialog?.confirm ?? 'Continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const invoicesSection = invoiceHistoryDict ? (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {invoiceHistoryDict.title ?? 'Subscription invoices'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {invoiceHistoryDict.description ?? 'Review the invoices generated when you activate your subscription.'}
        </p>
      </div>

      {invoiceActionSuccess && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {invoiceActionSuccess}
        </div>
      )}

      {invoiceActionError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {invoiceActionError}
        </div>
      )}

      {invoiceError && !invoiceActionError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          {invoiceError}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
            search
          </span>
          <Input
            value={invoiceQuery}
            onChange={(event) => setInvoiceQuery(event.target.value)}
            className="h-12 w-full rounded-lg bg-white pl-10 pr-4 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-primary dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-400"
            placeholder={invoiceHistoryDict.searchPlaceholder ?? 'Search invoices...'}
            type="text"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {archivedInvoicesCount > 0 && (
            <Button
              onClick={() => {
                setShowArchivedInvoices(!showArchivedInvoices);
                setSelectedInvoices([]);
              }}
              variant="outline"
              className="w-full md:w-auto"
            >
              <span className="material-symbols-outlined mr-2">
                {showArchivedInvoices ? 'inventory_2' : 'archive'}
              </span>
              {showArchivedInvoices
                ? invoiceHistoryDict.showActive ?? 'Show active invoices'
                : (invoiceHistoryDict.viewArchived ?? 'View archived ({{count}})').replace(
                  '{{count}}',
                  `${archivedInvoicesCount}`,
                )}
            </Button>
          )}
          {selectedInvoices.length > 0 && (
            <Button
              onClick={showArchivedInvoices ? handleUnarchiveInvoices : handleArchiveInvoices}
              disabled={archivingInvoices || unarchivingInvoices}
              variant="outline"
              className="w-full md:w-auto"
            >
              <span className="material-symbols-outlined mr-2">
                {archivingInvoices || unarchivingInvoices
                  ? 'hourglass_empty'
                  : showArchivedInvoices
                    ? 'unarchive'
                    : 'archive'}
              </span>
              {archivingInvoices
                ? invoiceHistoryDict.archiving ?? 'Archiving…'
                : unarchivingInvoices
                  ? invoiceHistoryDict.unarchiving ?? 'Unarchiving…'
                  : showArchivedInvoices
                    ? (invoiceHistoryDict.unarchiveSelected ?? 'Unarchive {{count}} selected').replace(
                      '{{count}}',
                      `${selectedInvoices.length}`,
                    )
                    : (invoiceHistoryDict.archiveSelected ?? 'Archive {{count}} selected').replace(
                      '{{count}}',
                      `${selectedInvoices.length}`,
                    )}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-slate-900/50">
        <div className="overflow-x-auto">
          <Table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <TableHeader className="bg-slate-50 text-xs uppercase text-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
              <TableRow>
                <TableHead className="px-6 py-3">
                  <Checkbox
                    checked={isInvoicesIndeterminate ? 'indeterminate' : isAllInvoicesSelected}
                    onCheckedChange={(checked) => handleSelectAllInvoices(Boolean(checked), filteredInvoiceIds)}
                    aria-label={invoiceHistoryDict.selectAll ?? 'Select all invoices'}
                  />
                </TableHead>
                <TableHead className="px-6 py-3">{invoiceHistoryDict.table?.date ?? 'Date'}</TableHead>
                <TableHead className="px-6 py-3">{invoiceHistoryDict.table?.amount ?? 'Amount'}</TableHead>
                <TableHead className="px-6 py-3">{invoiceHistoryDict.table?.status ?? 'Status'}</TableHead>
                <TableHead className="px-6 py-3">{invoiceHistoryDict.table?.periodEnd ?? 'Covers through'}</TableHead>
                <TableHead className="px-6 py-3">{invoiceHistoryDict.table?.method ?? 'Method'}</TableHead>
                <TableHead className="px-6 py-3 text-center">{invoiceHistoryDict.table?.invoice ?? 'Invoice'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceLoading && filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-6 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {invoiceHistoryDict.loading ?? 'Loading invoices…'}
                  </TableCell>
                </TableRow>
              ) : null}

              {!invoiceLoading && filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-6 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {invoiceHistoryDict.empty ?? 'No subscription invoices yet.'}
                  </TableCell>
                </TableRow>
              ) : null}

              {filteredInvoices.map((invoice) => {
                const statusLabel = invoiceStatusLabels[invoice.status as keyof typeof invoiceStatusLabels] ?? invoice.status;
                const statusStyle = invoiceStatusStyles[invoice.status] ??
                  'bg-slate-200 text-slate-700 dark:bg-slate-700/30 dark:text-slate-200';
                const isLoadingInvoice = loadingInvoiceId === invoice.id;

                return (
                  <TableRow key={invoice.id} className="border-b border-black/10 dark:border-white/10">
                    <TableCell className="px-6 py-4">
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={(checked) => handleSelectInvoice(invoice.id, Boolean(checked))}
                        aria-label={`Select invoice ${invoice.id}`}
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-900 dark:text-white">{formatInvoiceDate(invoice.created_at)}</span>
                        {invoice.archived ? (
                          <Badge variant="outline" className="w-fit text-xs">
                            {invoiceHistoryDict.archivedBadge ?? 'Archived'}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {formatCurrency.format(invoice.amount_cents / PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS)}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge className={statusStyle}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">{formatPeriodEnd(invoice.period_end)}</TableCell>
                    <TableCell className="px-6 py-4">
                      {invoiceMethodLabels[invoice.gateway] ?? invoice.gateway.toUpperCase()}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoadingInvoice}
                        onClick={() => handleViewInvoice(invoice.id)}
                        className="text-xs"
                      >
                        {isLoadingInvoice
                          ? invoiceHistoryDict.loadingInvoice ?? 'Loading invoice…'
                          : invoiceHistoryDict.viewInvoice ?? 'View invoice'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  ) : null;

  const invoiceViewerSection = invoiceHistoryDict ? (
    <Dialog open={Boolean(invoiceViewer)} onOpenChange={handleInvoiceViewerChange}>
      <DialogContent className="flex h-[80vh] w-[min(100vw-2rem,960px)] flex-col gap-4">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            <span>{invoiceHistoryDict.table?.invoice ?? 'Invoice'}</span>
            {invoiceViewer?.invoiceId ? (
              <span className="text-sm font-medium text-muted-foreground">
                #{invoiceViewer.invoiceId.slice(0, 8).toUpperCase()}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {invoiceHistoryDict.invoiceViewerHint ?? 'Use your browser options to print or save this invoice.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-xl border border-border/60 bg-background">
          {invoiceViewer ? (
            <iframe
              title={`invoice-${invoiceViewer.invoiceId}`}
              srcDoc={invoiceViewer.html}
              className="h-full w-full bg-white"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  if (isStandaloneLayout) {
    return (
      <>
        {/* Payment handler for return from new payment result system */}
        {paymentStatus === 'success' && decodedOriginUrl && userId && (paymentToken || paymentSessionId) && (
          <SubscriptionReturnHandler
            orderId={paymentToken || undefined}
            sessionId={paymentSessionId || undefined}
            userId={userId}
            planId={paymentPlanId || undefined}
            originUrl={decodedOriginUrl}
            onSuccess={() => {
              loadSummary();
              setCheckoutSuccess(subscriptionDict.paymentDialog?.walletSuccess ?? 'Subscription activated successfully!');
            }}
            onError={(error) => {
              setCheckoutError(error);
            }}
          />
        )}

        {/* Legacy payment handler for direct PayPal return (backward compatibility) */}
        {paymentStatus === 'success' && !decodedOriginUrl && paymentToken && userId && (
          <SubscriptionPaymentHandler
            orderId={paymentToken}
            userId={userId}
            planId={paymentPlanId || undefined}
            onSuccess={() => {
              loadSummary();
              setCheckoutSuccess(subscriptionDict.paymentDialog?.walletSuccess ?? 'Payment completed successfully!');
            }}
            onError={(error) => {
              setCheckoutError(error);
            }}
          />
        )}

        <div className="min-h-screen bg-[#f6f8f6] text-slate-900 dark:bg-[#0b1910] dark:text-slate-100" data-lang={lang}>
          <main className="px-4 py-10 sm:px-6 lg:px-12">
            <div className="mx-auto w-full max-w-3xl space-y-8">
              {headerSection}
              {statusSection}
              {loadingSection}
              {errorSection}
              {invoicesSection}
            </div>
          </main>

          {dialogSection}
          {invoiceViewerSection}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Payment handler for return from new payment result system */}
      {paymentStatus === 'success' && decodedOriginUrl && userId && (paymentToken || paymentSessionId) && (
        <SubscriptionReturnHandler
          orderId={paymentToken || undefined}
          sessionId={paymentSessionId || undefined}
          userId={userId}
          planId={paymentPlanId || undefined}
          originUrl={decodedOriginUrl}
          onSuccess={() => {
            loadSummary();
            setCheckoutSuccess(subscriptionDict.paymentDialog?.walletSuccess ?? 'Subscription activated successfully!');
          }}
          onError={(error) => {
            setCheckoutError(error);
          }}
        />
      )}

      {/* Legacy payment handler for direct PayPal return (backward compatibility) */}
      {paymentStatus === 'success' && !decodedOriginUrl && paymentToken && userId && (
        <SubscriptionPaymentHandler
          orderId={paymentToken}
          userId={userId}
          planId={paymentPlanId || undefined}
          onSuccess={() => {
            loadSummary();
            setCheckoutSuccess(subscriptionDict.paymentDialog?.walletSuccess ?? 'Payment completed successfully!');
          }}
          onError={(error) => {
            setCheckoutError(error);
          }}
        />
      )}

      <div data-lang={lang}>
        <div className="space-y-8">
          {headerSection}
          {statusSection}
          {loadingSection}
          {errorSection}
          {invoicesSection}
        </div>
        {dialogSection}
        {invoiceViewerSection}
      </div>
    </>
  );
}
