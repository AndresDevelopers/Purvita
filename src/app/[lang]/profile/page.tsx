'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { supabase, getSafeSession } from '@/lib/supabase';
import { fetchWithCsrf } from '@/lib/utils/admin-csrf-helpers';
import { useToast } from '@/hooks/use-toast';
import { BalanceRecharge } from '@/components/user/balance-recharge';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';
import { ReferralSettingsForm } from '@/modules/referrals/ui/referral-settings-form';
import type { ProfileSummaryPayload } from '@/modules/profile/domain/types';
import { PhaseRewardsSection } from '@/components/profile/phase-rewards-section';
import { TeamMessagesInbox, type TeamMessagesCopy } from '@/modules/team-messaging/ui/team-messages-inbox';

type ProfileSummaryResponse = ProfileSummaryPayload;
type ProfileSummaryPatchResult = Partial<Pick<ProfileSummaryResponse, 'profile' | 'membership'>> | null;

interface PhaseRewardSnapshot {
  reward_id: string;
  phase: number;
  has_free_product: boolean;
  free_product_used: boolean;
  credit_remaining_cents: number;
  credit_total_cents?: number | null;
  expires_at: string | null;
}

interface PhaseRewardConfigurationSnapshot {
  phase: number;
  creditCents: number;
  freeProductValueCents: number;
}

interface PhaseRewardsDictionary {
  title: string;
  description: string;
  noRewards: string;
  noRewardsDescription: string;
  phase: string;
  freeProduct: {
    title: string;
    description: string;
    value: string;
    used: string;
    shopNow: string;
  };
  storeCredit: {
    title: string;
    description: string;
    remaining: string;
    used: string;
    total: string;
    shopNow: string;
    expiresOn: string;
    transferToEarnings: string;
    transferSuccess: string;
    transferError: string;
  };
}

interface PhaseRewardsResponsePayload {
  reward: PhaseRewardSnapshot | null;
  configurations?: PhaseRewardConfigurationSnapshot[];
}

const defaultPhaseRewardsDict: PhaseRewardsDictionary = {
  title: 'Monthly Rewards',
  description: 'Your rewards for maintaining your MLM phase this month',
  noRewards: 'No active rewards this month',
  noRewardsDescription: 'Maintain your MLM phase to unlock monthly rewards',
  phase: 'Phase',
  freeProduct: {
    title: 'Free Product',
    description: 'Choose one product up to $65 value',
    value: 'Value',
    used: 'Already used',
    shopNow: 'Shop Now',
  },
  storeCredit: {
    title: 'Store Credit',
    description: 'Automatically applied to your purchases',
    remaining: 'Remaining',
    used: 'Used',
    total: 'Total',
    shopNow: 'Shop Now',
    expiresOn: 'Expires on',
    transferToEarnings: 'Transfer to Earnings',
    transferSuccess: 'Rewards transferred successfully',
    transferError: 'Failed to transfer rewards. Please try again.',
  },
};

const defaultMessagesCopy: TeamMessagesCopy = {
  title: 'Team messages',
  description: 'Keep your organisation aligned with quick, private conversations.',
  loading: 'Loading your messages…',
  retry: 'Try again',
  errorTitle: 'Messages unavailable',
  errorDescription: 'We could not load your inbox. Refresh the page or try again later.',
  emptyTitle: 'No messages yet',
  emptyDescription: 'Messages from your team will appear here once someone reaches out.',
  threadListLabel: 'Conversations',
  conversationLabel: 'Conversation',
  noSelectionTitle: 'Select a conversation',
  noSelectionDescription: 'Choose a teammate to view the full message history.',
  reply: {
    label: 'Reply to conversation',
    placeholder: 'Type your response…',
    send: 'Send reply',
    sending: 'Sending…',
    successTitle: 'Reply sent',
    successDescription: 'Your teammate will receive your response immediately.',
    errorTitle: 'Unable to send reply',
    errorDescription: 'We could not send your reply. Please try again shortly.',
  },
  delete: {
    button: 'Delete',
    confirmTitle: 'Delete message?',
    confirmDescription: 'This action cannot be undone. The message will be permanently deleted.',
    confirm: 'Delete message',
    cancel: 'Cancel',
    successTitle: 'Message deleted',
    successDescription: 'The message has been removed from the conversation.',
    errorTitle: 'Unable to delete message',
    errorDescription: 'We could not delete your message. Please try again shortly.',
  },
  deleteThread: {
    button: 'Delete conversation',
    confirmTitle: 'Delete conversation?',
    confirmDescription: 'This will delete all your messages in this conversation. This action cannot be undone.',
    confirm: 'Delete conversation',
    cancel: 'Cancel',
    successTitle: 'Conversation deleted',
    successDescription: 'Your messages have been removed from this conversation.',
    errorTitle: 'Unable to delete conversation',
    errorDescription: 'We could not delete the conversation. Please try again shortly.',
  },
  filter: {
    label: 'Filter',
    all: 'All messages',
    unread: 'Unread only',
    read: 'Read only',
  },
  helper: 'Messages are delivered instantly and stay between you and your teammate.',
  refresh: 'Refresh',
  meta: {
    you: 'You',
    sentOn: 'Sent on {{date}}',
    receivedOn: 'Received on {{date}}',
  },
  tabUnreadA11y: 'You have {{count}} unread messages',
};

const isPhaseRewardSnapshot = (value: unknown): value is PhaseRewardSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.reward_id === 'string' &&
    typeof record.phase === 'number' &&
    typeof record.has_free_product === 'boolean' &&
    typeof record.free_product_used === 'boolean' &&
    typeof record.credit_remaining_cents === 'number' &&
    (record.expires_at === null || typeof record.expires_at === 'string')
  );
};

const isPhaseRewardsResponsePayload = (value: unknown): value is PhaseRewardsResponsePayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'reward')) {
    return false;
  }

  const payload = value as { reward: unknown; configurations?: unknown };
  const rewardValid = payload.reward === null || isPhaseRewardSnapshot(payload.reward);

  if (!rewardValid) {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'configurations') || payload.configurations === undefined) {
    return true;
  }

  if (!Array.isArray(payload.configurations)) {
    return false;
  }

  return payload.configurations.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const record = item as Record<string, unknown>;
    return (
      typeof record.phase === 'number' &&
      typeof record.creditCents === 'number' &&
      typeof record.freeProductValueCents === 'number'
    );
  });
};

const isProfileSnapshot = (
  value: ProfileSummaryResponse['profile'] | undefined,
): value is NonNullable<ProfileSummaryResponse['profile']> => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof value.id === 'string' && typeof value.email === 'string';
};

const applyProfileSummaryPatch = (
  previous: ProfileSummaryResponse,
  patch: NonNullable<ProfileSummaryPatchResult>,
): ProfileSummaryResponse => {
  let nextProfile = previous.profile;

  if (Object.prototype.hasOwnProperty.call(patch, 'profile')) {
    const profileCandidate = patch.profile;

    if (profileCandidate === null) {
      nextProfile = null;
    } else if (isProfileSnapshot(profileCandidate)) {
      nextProfile = previous.profile ? { ...previous.profile, ...profileCandidate } : profileCandidate;
    }
  }

  const nextMembership =
    Object.prototype.hasOwnProperty.call(patch, 'membership') && patch.membership
      ? { ...previous.membership, ...patch.membership }
      : previous.membership;

  return {
    ...previous,
    profile: nextProfile,
    membership: nextMembership,
  };
};

interface ProfilePageProps {
  params: Promise<{
    lang: Locale;
  }>;
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  fulfillment_company: string;
}

const emptyFormState: FormState = {
  name: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  fulfillment_company: '',
};

const formatCurrency = (value: number, locale: Locale) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
  }).format(value / 100);
};

const formatUsdCurrency = (value: number, locale: Locale, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value / 100);
  } catch (error) {
    console.error('Failed to format USD currency', error);
    return `$${(value / 100).toFixed(2)}`;
  }
};

const formatDate = (value: string | null, locale: Locale) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

const formatDateTime = (value: string | null, locale: Locale) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

const extractFormState = (profile: ProfileSummaryResponse['profile']): FormState => ({
  name: profile?.name ?? '',
  phone: profile?.phone ?? '',
  address: profile?.address ?? '',
  city: profile?.city ?? '',
  state: profile?.state ?? '',
  postal_code: profile?.postal_code ?? '',
  fulfillment_company: profile?.fulfillment_company ?? '',
});

const orderMatchesQuery = (query: string, order: ProfileSummaryResponse['orders'][number]) => {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = [
    order.id,
    order.status,
    order.items.map((item) => item.name ?? '').join(' '),
    order.tracking?.latestStatus ?? '',
    order.tracking?.responsible_company ?? '',
    order.tracking?.tracking_code ?? '',
    order.tracking?.location ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
};

export default function ProfilePage({ params }: ProfilePageProps) {
  const { lang } = use(params);
  const dict = useAppDictionary();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [summary, setSummary] = useState<ProfileSummaryResponse | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyFormState);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [orderQuery, setOrderQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [phaseRewards, setPhaseRewards] = useState<PhaseRewardSnapshot | null>(null);
  const [phaseRewardsLoaded, setPhaseRewardsLoaded] = useState(false);
  const [phaseRewardConfigurations, setPhaseRewardConfigurations] = useState<PhaseRewardConfigurationSnapshot[]>([]);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [invoiceViewer, setInvoiceViewer] = useState<{ orderId: string; html: string } | null>(null);
  const [_isAdmin, setIsAdmin] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [archivingOrders, setArchivingOrders] = useState(false);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [unarchivingOrders, setUnarchivingOrders] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authReadyRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const loadSummary = useCallback(async (isRetry = false) => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setPhaseRewardsLoaded(false);
        setPhaseRewards(null);
      }

      const {
        data: { session },
        error: sessionError
      } = await getSafeSession();

      console.log('[Profile] Session check:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        sessionError: sessionError,
      });

      if (!session?.user?.id) {
        // Si no hay sesión y no estamos en un retry, intentar de nuevo con backoff
        if (!isRetry && retryCountRef.current < 3 && !authReadyRef.current) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 4000);
          console.log(`[Profile] Session not ready, retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/3)`);

          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          retryTimeoutRef.current = setTimeout(() => {
            retryCountRef.current += 1;
            void loadSummary(true);
          }, delay);

          return;
        }
        throw new Error('Missing authenticated user');
      }

      // Sesión exitosa, resetear contadores
      retryCountRef.current = 0;
      authReadyRef.current = true;

      if (isMountedRef.current) {
        setUserId(session.user.id);
      }

      const fetchSummaryBundle = async () => {
        let summaryResponse: Response;

        console.log('[Profile] Fetching summary for user:', session.user.id);
        console.log('[Profile] API URL:', '/api/profile/summary');
        console.log('[Profile] Window location:', typeof window !== 'undefined' ? window.location.href : 'SSR');

        try {
          summaryResponse = await fetch('/api/profile/summary', {
            headers: {
              'x-user-id': session.user.id,
            },
            cache: 'no-store',
            credentials: 'include',
          });
        } catch (fetchError) {
          console.error('[Profile] Network error fetching summary:', {
            name: fetchError instanceof Error ? fetchError.name : 'Unknown',
            message: fetchError instanceof Error ? fetchError.message : String(fetchError),
            type: fetchError instanceof TypeError ? 'Network/CORS error' : 'Other error',
            stack: fetchError instanceof Error ? fetchError.stack : undefined,
            cause: fetchError instanceof Error ? fetchError.cause : undefined
          });
          throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Could not connect to server'}`);
        }

        console.log('[Profile] Summary response received:', {
          ok: summaryResponse.ok,
          status: summaryResponse.status,
          statusText: summaryResponse.statusText,
          url: summaryResponse.url
        });

        const rewardsPromise = fetch('/api/profile/rewards', {
          headers: {
            'x-user-id': session.user.id,
          },
          cache: 'no-store',
          credentials: 'include',
        }).catch((rewardsError) => {
          console.error('[Profile] Failed to request phase rewards:', rewardsError);
          return null;
        });

        const [_ignored, rewardsResponse] = await Promise.all([Promise.resolve(summaryResponse), rewardsPromise]);

        if (!summaryResponse.ok) {
          let errorBody = 'Could not read error response';
          let parsedError = null;

          try {
            const text = await summaryResponse.text();
            errorBody = text;
            try {
              parsedError = JSON.parse(text);
            } catch {
              // Not JSON, keep as text
            }
          } catch (e) {
            console.error('[Profile] Failed to read error body:', e);
          }

          console.error('[Profile] API error response:', {
            status: summaryResponse.status,
            statusText: summaryResponse.statusText,
            url: summaryResponse.url,
            headers: Object.fromEntries(summaryResponse.headers.entries()),
            bodyText: errorBody,
            bodyParsed: parsedError
          });

          const errorMessage = parsedError?.error || parsedError?.message || errorBody || summaryResponse.statusText;
          throw new Error(`Failed to load profile summary (${summaryResponse.status}): ${errorMessage}`);
        }

        let rewardSnapshot: PhaseRewardSnapshot | null = null;
        let rewardConfigurations: PhaseRewardConfigurationSnapshot[] = [];

        if (rewardsResponse) {
          if (rewardsResponse.ok) {
            try {
              const rewardsPayload = await rewardsResponse.json();
              if (isPhaseRewardsResponsePayload(rewardsPayload)) {
                rewardSnapshot = rewardsPayload.reward;
                rewardConfigurations = Array.isArray(rewardsPayload.configurations)
                  ? rewardsPayload.configurations
                  : [];
              } else {
                console.warn('[Profile] Received unexpected phase rewards payload', rewardsPayload);
              }
            } catch (parseError) {
              console.error('[Profile] Failed to parse phase rewards payload:', parseError);
            }
          } else if (rewardsResponse.status !== 404) {
            console.error('[Profile] Failed to load phase rewards:', rewardsResponse.statusText);
          }
        }

        const payload = (await summaryResponse.json()) as ProfileSummaryResponse;
        return { payload, rewardSnapshot, rewardConfigurations };
      };

      let { payload, rewardSnapshot, rewardConfigurations } = await fetchSummaryBundle();

      if (!payload.wallet || !payload.membership.phase) {
        console.log('[Profile] Initializing missing user data...');
        try {
          const response = await fetchWithCsrf('/api/profile/initialize', {
            method: 'POST',
          });

          if (!response.ok) {
            throw new Error('Failed to initialize user data');
          }

          const retry = await fetchSummaryBundle();
          payload = retry.payload;
          rewardSnapshot = retry.rewardSnapshot;
          rewardConfigurations = retry.rewardConfigurations;
        } catch (initErr) {
          console.error('[Profile] Failed to initialize user data:', initErr);
        }
      }

      if (isMountedRef.current) {
        setSummary(payload);
        setFormData(extractFormState(payload.profile));
        setReferralCode(payload.profile?.referral_code ?? null);
        setPhaseRewards(rewardSnapshot);
        setPhaseRewardConfigurations(rewardConfigurations);

        // Check if user has admin access
        if (payload.profile) {
          // Use API route to check admin access instead of calling getUserPermissions directly
          // This prevents "cookies() called outside request scope" error
          try {
            const response = await fetch('/api/check-admin-access', {
              method: 'GET',
              credentials: 'include',
            });

            if (response.ok) {
              const data = await response.json();
              setIsAdmin(data.hasAccess === true);
            } else {
              setIsAdmin(false);
            }
          } catch (error) {
            console.error('Error checking admin access:', error);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }

        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Profile] Error loading summary:', {
          error: err,
          message,
          retryCount: retryCountRef.current,
          authReady: authReadyRef.current,
          stack: err instanceof Error ? err.stack : undefined
        });

        // Solo mostrar error si ya intentamos varias veces
        if (retryCountRef.current >= 3 || authReadyRef.current) {
          setError(message);
          setPhaseRewards(null);
          setPhaseRewardConfigurations([]);
        }
      }
    } finally {
      if (isMountedRef.current) {
        // Solo marcar como no loading si no hay retry pendiente
        if (retryCountRef.current >= 3 || authReadyRef.current || retryTimeoutRef.current === null) {
          setLoading(false);
          setPhaseRewardsLoaded(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Escuchar cambios en el estado de autenticación de Supabase
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMountedRef.current) {
        return;
      }

      // Solo reaccionar a eventos que indican que la sesión está lista
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          console.log(`[Profile] Auth state changed: ${event}, reloading data`);
          authReadyRef.current = true;
          retryCountRef.current = 0;
          void loadSummary();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSummary]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadSummary();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadSummary]);

  const formatTemplate = (template: string | undefined, replacements: Record<string, string>) => {
    if (!template) {
      return undefined;
    }

    return Object.entries(replacements).reduce(
      (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
      template,
    );
  };

  const rechargeStatus = searchParams?.get('recharge');
  const rechargeProvider = searchParams?.get('provider');
  const rechargeAmount = searchParams?.get('amount');
  const rechargeMode = searchParams?.get('mode');
  const rechargeReference = searchParams?.get('recharge_id');

  useEffect(() => {
    if (!rechargeStatus) {
      return;
    }

    let cancelled = false;

    const providerLabel =
      rechargeProvider === 'paypal'
        ? dict.checkout?.paypal ?? 'PayPal'
        : rechargeProvider === 'stripe'
          ? dict.checkout?.stripe ?? 'Stripe'
          : rechargeProvider ?? 'Payment provider';

    const parsedAmount = rechargeAmount ? Number.parseFloat(rechargeAmount) : NaN;
    const amountCents = Number.isFinite(parsedAmount) ? Math.round(parsedAmount * 100) : 0;
    const replacements = {
      amount: formatCurrency(amountCents, lang),
      provider: providerLabel,
    };

    const clearParams = () => {
      if (typeof window === 'undefined' || cancelled) {
        return;
      }

      const url = new URL(window.location.href);
      ['recharge', 'provider', 'amount', 'recharge_id', 'mode'].forEach((key) => url.searchParams.delete(key));
      router.replace(`${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ''}${url.hash}`, { scroll: false });
    };

    const confirmTestRecharge = async () => {
      const providerIsSupported = rechargeProvider === 'paypal' || rechargeProvider === 'stripe';
      const shouldSimulate = rechargeStatus === 'success' && rechargeMode === 'test' && providerIsSupported;

      if (!shouldSimulate) {
        return;
      }

      if (!rechargeReference || rechargeReference.length < 6) {
        throw new Error('Missing recharge reference. Please try the test payment again.');
      }

      if (amountCents <= 0) {
        throw new Error('Invalid recharge amount returned from the payment provider.');
      }

      const response = await fetch('/api/profile/recharge/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: rechargeProvider,
          rechargeId: rechargeReference,
          amountCents,
          mode: 'test',
          currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Failed to confirm the sandbox recharge.');
      }
    };

    if (rechargeStatus === 'success') {
      const successTitle = dict.profile?.balanceRecharge?.successToast?.title ?? 'Payment received';
      const successDescription =
        formatTemplate(dict.profile?.balanceRecharge?.successToast?.description, replacements) ??
        `We received your ${providerLabel} payment. Your balance will refresh shortly.`;

      void (async () => {
        try {
          await confirmTestRecharge();
          toast({ title: successTitle, description: successDescription });
          await loadSummary();
        } catch (_error) {
          console.error('Failed to finalize balance recharge', _error);
          const message =
            (_error as any) instanceof Error
              ? (_error as any).message
              : dict.profile?.balanceRecharge?.errorToast?.description ??
              'We could not confirm your payment. Please try again or contact support.';

          toast({
            title: dict.profile?.balanceRecharge?.errorToast?.title ?? 'Recharge failed',
            description: message,
            variant: 'destructive',
          });
        } finally {
          clearParams();
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (rechargeStatus === 'cancel') {
      const title = dict.profile?.balanceRecharge?.cancelToast?.title ?? 'Recharge cancelled';
      const description =
        formatTemplate(dict.profile?.balanceRecharge?.cancelToast?.description, replacements) ??
        'No charge was made. You can try again whenever you are ready.';
      toast({ title, description });
      clearParams();
      return () => {
        cancelled = true;
      };
    }

    if (rechargeStatus === 'error') {
      const title = dict.profile?.balanceRecharge?.errorToast?.title ?? 'Recharge failed';
      const description =
        formatTemplate(dict.profile?.balanceRecharge?.errorToast?.description, replacements) ??
        'We could not confirm your payment. Please try again or contact support.';
      toast({ title, description, variant: 'destructive' });
      clearParams();
      return () => {
        cancelled = true;
      };
    }

    return () => {
      cancelled = true;
    };
  }, [
    rechargeStatus,
    rechargeProvider,
    rechargeAmount,
    rechargeMode,
    rechargeReference,
    dict.checkout?.paypal,
    dict.checkout?.stripe,
    dict.profile?.balanceRecharge,
    toast,
    loadSummary,
    router,
    lang,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    try {
      setSaving(true);
      const response = await fetchWithCsrf('/api/profile/summary', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const payload = (await response.json()) as ProfileSummaryPatchResult;
      if (!payload) {
        throw new Error('Profile update response was empty.');
      }
      setSummary((prev) => (prev ? applyProfileSummaryPatch(prev, payload) : prev));
      const nextProfile = payload.profile ?? null;
      setFormData(extractFormState(nextProfile));
      setReferralCode(nextProfile?.referral_code ?? null);

      toast({
        title: 'Profile updated',
        description: 'Your profile information was saved successfully.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !summary?.profile?.id || !userId) return;

    setIsUploading(true);

    // ✅ SECURITY: Validate file against server-configured upload limits
    try {
      const validationResponse = await fetch('/api/upload/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: file.size,
          type: file.type,
          category: 'avatar',
        }),
      });

      const validationResult = await validationResponse.json();

      if (!validationResult.valid) {
        toast({
          title: 'Error',
          description: validationResult.error || 'File validation failed.',
          variant: 'destructive',
        });
        setIsUploading(false);
        return;
      }
    } catch (validationError) {
      console.error('Error validating file:', validationError);
      toast({
        title: 'Error',
        description: 'Failed to validate file. Please try again.',
        variant: 'destructive',
      });
      setIsUploading(false);
      return;
    }

    try {
      if (summary.profile.avatar_url) {
        const oldPath = summary.profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${summary.profile.id}/${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${summary.profile.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const response = await fetch('/api/profile/summary', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile picture');
      }

      const payload = (await response.json()) as ProfileSummaryPatchResult;
      if (!payload) {
        throw new Error('Profile update response was empty.');
      }
      setSummary((prev) => (prev ? applyProfileSummaryPatch(prev, payload) : prev));

      toast({
        title: 'Success',
        description: 'Profile picture updated successfully.',
      });
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast({
        title: 'Error',
        description: 'Failed to upload profile picture.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!summary?.profile?.avatar_url || !summary.profile?.id || !userId) return;

    setIsUploading(true);

    try {
      const path = summary.profile.avatar_url.split('/').pop();
      if (path) {
        await supabase.storage.from('avatars').remove([`${summary.profile.id}/${path}`]);
      }

      const response = await fetch('/api/profile/summary', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ avatar_url: '' }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove profile picture');
      }

      const payload = (await response.json()) as ProfileSummaryPatchResult;
      if (!payload) {
        throw new Error('Profile update response was empty.');
      }
      setSummary((prev) => (prev ? applyProfileSummaryPatch(prev, payload) : prev));

      toast({
        title: 'Success',
        description: 'Profile picture removed successfully.',
      });
    } catch (err) {
      console.error('Error removing avatar:', err);
      toast({
        title: 'Error',
        description: 'Failed to remove profile picture.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewInvoice = async (orderId: string) => {
    try {
      setLoadingInvoiceId(orderId);

      const response = await fetch(`/api/orders/${orderId}/invoice`, { cache: 'no-store' });

      if (!response.ok) {
        let errorMessage = dict.profile.orderHistory.invoiceErrorDescription ?? 'Unable to load invoice';
        try {
          const payload = await response.json();
          const details = typeof payload?.details === 'string' ? payload.details : undefined;
          const error = typeof payload?.error === 'string' ? payload.error : undefined;
          errorMessage = details ?? error ?? errorMessage;
        } catch {
          // Ignore JSON parse errors; stick with default message
        }
        throw new Error(errorMessage);
      }

      const htmlContent = await response.text();
      setInvoiceViewer({ orderId, html: htmlContent });
    } catch (err) {
      console.error('Error loading invoice:', err);
      const message =
        err instanceof Error
          ? err.message
          : dict.profile.orderHistory.invoiceErrorDescription ?? 'Unable to load invoice';
      toast({
        title: dict.profile.orderHistory.invoiceErrorTitle ?? 'Unable to load invoice',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleInvoiceViewerChange = useCallback((open: boolean) => {
    if (!open) {
      setInvoiceViewer(null);
    }
  }, []);

  const handleArchiveOrders = async () => {
    if (selectedOrders.length === 0 || !userId) return;

    try {
      setArchivingOrders(true);

      const response = await fetch('/api/orders/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ orderIds: selectedOrders }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive orders');
      }

      toast({
        title: 'Orders archived',
        description: `Successfully archived ${selectedOrders.length} order${selectedOrders.length > 1 ? 's' : ''}.`,
      });

      setSelectedOrders([]);
      await loadSummary();
    } catch (err) {
      console.error('Error archiving orders:', err);
      const message = err instanceof Error ? err.message : 'Failed to archive orders';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setArchivingOrders(false);
    }
  };

  const handleUnarchiveOrders = async () => {
    if (selectedOrders.length === 0 || !userId) return;

    try {
      setUnarchivingOrders(true);

      const response = await fetch('/api/orders/unarchive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ orderIds: selectedOrders }),
      });

      if (!response.ok) {
        throw new Error('Failed to unarchive orders');
      }

      toast({
        title: 'Orders unarchived',
        description: `Successfully unarchived ${selectedOrders.length} order${selectedOrders.length > 1 ? 's' : ''}.`,
      });

      setSelectedOrders([]);
      await loadSummary();
    } catch (err) {
      console.error('Error unarchiving orders:', err);
      const message = err instanceof Error ? err.message : 'Failed to unarchive orders';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUnarchivingOrders(false);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders(prev =>
      checked
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const filteredOrders = useMemo(() => {
    return (summary?.orders ?? [])
      .filter((order) => showArchivedOrders ? order.archived : !order.archived)
      .filter((order) => orderMatchesQuery(orderQuery, order));
  }, [summary?.orders, orderQuery, showArchivedOrders]);

  const archivedOrdersCount = useMemo(() => {
    return (summary?.orders ?? []).filter((order) => order.archived).length;
  }, [summary?.orders]);

  const isAllSelected = filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length;
  const _isIndeterminate = selectedOrders.length > 0 && selectedOrders.length < filteredOrders.length;

  const profileReferralCode = summary?.profile?.referral_code ?? null;

  useEffect(() => {
    setReferralCode(profileReferralCode);
  }, [profileReferralCode]);

  const referralSettingsDict = dict.profile?.referralSettings;
  const referralShareFallback = summary?.profile?.id ?? userId;

  const membershipPhase = summary?.membership.phase?.phase ?? 0;
  const canViewMonthlyRewards = membershipPhase >= 1 && membershipPhase <= 3;
  const phaseLabel = dict.profile?.membershipPhaseLabel
    ? dict.profile.membershipPhaseLabel.replace('{{value}}', `${membershipPhase}`)
    : `Phase ${membershipPhase}`;
  const commissionRate = summary?.membership.phase?.ecommerce_commission ?? 0;
  const subscriptionStatus = summary?.membership.subscription?.status ?? 'unpaid';
  const subscriptionType = summary?.membership.subscription?.subscription_type ?? null;
  const isMLMSubscription = subscriptionType === 'mlm';
  const subscriptionLabels = dict.subscriptionManagement?.statuses ?? {};
  const subscriptionLabel = subscriptionLabels?.[subscriptionStatus as keyof typeof subscriptionLabels] ?? subscriptionStatus;
  const _subscriptionGateway = summary?.membership.subscription?.gateway ?? null;

  const orderStatusDict = dict.profile?.orderHistory?.statuses ?? {};

  const walletBalance = summary?.wallet?.balance_cents ?? 0;
  const networkEarnings = summary?.networkEarnings ?? null;
  const networkCurrency = networkEarnings?.currency ?? 'USD';
  const networkMembers = networkEarnings?.members ?? [];
  const networkTotalCents = networkEarnings?.totalAvailableCents ?? 0;
  const formatNetworkAmount = useMemo(
    () => (value: number) => formatUsdCurrency(value, lang, networkCurrency),
    [lang, networkCurrency],
  );
  const phaseRewardsDict = useMemo<PhaseRewardsDictionary>(() => {
    const overrides = dict.profile?.phaseRewards;

    if (!overrides) {
      return defaultPhaseRewardsDict;
    }

    return {
      ...defaultPhaseRewardsDict,
      ...overrides,
      freeProduct: {
        ...defaultPhaseRewardsDict.freeProduct,
        ...(overrides.freeProduct ?? {}),
      },
      storeCredit: {
        ...defaultPhaseRewardsDict.storeCredit,
        ...(overrides.storeCredit ?? {}),
      },
    };
  }, [dict.profile?.phaseRewards]);

  const profileMessagesDict = useMemo<TeamMessagesCopy>(() => {
    const overrides = (dict.profile?.messages ?? {}) as Partial<TeamMessagesCopy>;

    return {
      ...defaultMessagesCopy,
      ...overrides,
      reply: {
        ...defaultMessagesCopy.reply,
        ...(overrides.reply ?? {}),
      },
      delete: {
        ...defaultMessagesCopy.delete,
        ...(overrides.delete ?? {}),
      },
      deleteThread: {
        ...defaultMessagesCopy.deleteThread,
        ...(overrides.deleteThread ?? {}),
      },
      filter: {
        ...defaultMessagesCopy.filter,
        ...(overrides.filter ?? {}),
      },
      meta: {
        ...defaultMessagesCopy.meta,
        ...(overrides.meta ?? {}),
      },
    };
  }, [dict.profile?.messages]);

  const messagesTabLabel = dict.profile?.messagesTab ?? defaultMessagesCopy.title;

  return (
    <AuthGuard lang={lang}>
      <>
        <main className="flex flex-1 justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">{dict.profile.title}</h1>

          {error && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-500/20 dark:bg-rose-500/10">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">error</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-rose-900 dark:text-rose-200">Failed to load profile</h3>
                  <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{error}</p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadSummary()}
                      className="border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-500 dark:text-rose-300 dark:hover:bg-rose-900/20"
                    >
                      Try Again
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.reload()}
                      className="border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-500 dark:text-rose-300 dark:hover:bg-rose-900/20"
                    >
                      Reload Page
                    </Button>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300">
                      Technical details
                    </summary>
                    <div className="mt-2 rounded bg-rose-100 p-2 text-xs font-mono text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                      <p>Check the browser console (F12) for detailed error information.</p>
                      <p className="mt-1">Common causes:</p>
                      <ul className="ml-4 mt-1 list-disc">
                        <li>Authentication expired - try logging out and back in</li>
                        <li>Database tables not initialized - check server logs</li>
                        <li>Network connectivity issues</li>
                      </ul>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}

          <Tabs defaultValue="overview" className="mt-6 w-full">
            <TabsList className={`grid w-full ${isMLMSubscription ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="overview">{dict.profile.overview}</TabsTrigger>
              <TabsTrigger value="orders">{dict.profile.orders}</TabsTrigger>
              {/* Messages Tab - Only visible for MLM subscriptions */}
              {isMLMSubscription && (
                <TabsTrigger
                  value="messages"
                  className="relative"
                  aria-label={
                    unreadMessageCount > 0
                      ? profileMessagesDict.tabUnreadA11y.replace('{{count}}', `${unreadMessageCount}`)
                      : messagesTabLabel
                  }
                >
                  <span className="flex items-center gap-2">
                    {messagesTabLabel}
                    {unreadMessageCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white transition duration-200 ease-in-out dark:ring-slate-900"
                      >
                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-[2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{dict.profile.personalInformation}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-6" onSubmit={handleProfileSubmit}>
                    <div className="flex flex-wrap items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={summary?.profile?.avatar_url ?? undefined} alt="Profile picture" />
                        <AvatarFallback className="text-lg">
                          {summary?.profile?.name?.charAt(0)?.toUpperCase() || summary?.profile?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <Label>Profile Picture</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? 'Uploading…' : 'Change Picture'}
                          </Button>
                          {summary?.profile?.avatar_url && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleRemoveAvatar}
                              disabled={isUploading}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          aria-label="Upload profile picture"
                          title="Upload profile picture"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="name">{dict.profile.name}</Label>
                      <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Jane Doe" />
                    </div>
                    <div>
                      <Label htmlFor="email">{dict.profile.email}</Label>
                      <Input id="email" value={summary?.profile?.email ?? ''} disabled />
                    </div>
                    <div>
                      <Label htmlFor="phone">{dict.profile.phone}</Label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="(555) 123-4567" />
                    </div>
                    <div>
                      <Label htmlFor="fulfillment_company">{dict.profile.fulfillmentCompany}</Label>
                      <Input
                        id="fulfillment_company"
                        name="fulfillment_company"
                        value={formData.fulfillment_company}
                        onChange={handleInputChange}
                        placeholder="PurVita Logistics"
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">{dict.profile.address}</Label>
                      <Input id="address" name="address" value={formData.address} onChange={handleInputChange} placeholder="123 Wellness Lane" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor="city">{dict.profile.cityLabel}</Label>
                        <Input id="city" name="city" value={formData.city} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="state">{dict.profile.stateLabel}</Label>
                        <Input id="state" name="state" value={formData.state} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="postal_code">{dict.profile.postalCodeLabel}</Label>
                        <Input id="postal_code" name="postal_code" value={formData.postal_code} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Button type="submit" className="w-full sm:w-auto" disabled={saving || loading}>
                        {saving ? 'Saving…' : dict.profile.updateInformation}
                      </Button>
                      <Card className="w-full sm:w-auto sm:flex-1">
                        <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{dict.wallet.balanceLabel}</p>
                              <p className="text-lg font-bold">{formatCurrency(walletBalance, lang)}</p>
                            </div>
                            <BalanceRecharge userId={userId} lang={lang} onPaymentInitiated={() => setLoading(true)} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {/* Membership Details Card - Only visible for MLM subscriptions */}
                {isMLMSubscription && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{dict.profile.membershipDetails}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="flex items-baseline justify-between">
                        <p className="text-neutral-600 dark:text-neutral-400">{dict.profile.membershipLevel}</p>
                        <p className="font-semibold text-neutral-900 dark:text-white">{phaseLabel}</p>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-neutral-600 dark:text-neutral-400">Commission</p>
                        <p className="font-semibold text-neutral-900 dark:text-white">{Math.round(commissionRate * 100)}%</p>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-neutral-600 dark:text-neutral-400">{dict.profile.joinDate}</p>
                        <p className="font-semibold text-neutral-900 dark:text-white">{formatDate(summary?.membership.joinDate ?? null, lang)}</p>
                      </div>
                      {summary?.membership.sponsor?.id && (
                        <div className="flex items-baseline justify-between">
                          <p className="text-neutral-600 dark:text-neutral-400">{dict.profile.sponsorId}</p>
                          <p className="font-semibold text-neutral-900 dark:text-white">{summary.membership.sponsor.id}</p>
                        </div>
                      )}
                      {summary?.membership.sponsor?.email && (
                        <div className="flex items-baseline justify-between">
                          <p className="text-neutral-600 dark:text-neutral-400">{dict.profile.sponsorEmail}</p>
                          <p className="font-semibold text-neutral-900 dark:text-white">{summary.membership.sponsor.email}</p>
                        </div>
                      )}
                      {summary?.membership.referralCode && (
                        <div className="flex items-baseline justify-between">
                          <p className="text-neutral-600 dark:text-neutral-400">{dict.profile.referralCode}</p>
                          <p className="font-semibold text-neutral-900 dark:text-white">{summary.membership.referralCode}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-neutral-600 dark:text-neutral-400">{dict.profile.subscriptionStatus}</p>
                          <p className="font-semibold text-neutral-900 dark:text-white">{subscriptionLabel}</p>
                        </div>
                      </div>
                      <Button variant="outline" asChild className="w-full">
                        <Link href={`/${lang}/team`}>{dict.profile.viewTeamPerformance}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Network Earnings Card - Only visible for MLM subscriptions */}
                {isMLMSubscription && (
                  <Card>
                    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle>{dict.profile.networkEarnings?.title ?? 'Balance de ganancias'}</CardTitle>
                        <CardDescription>
                          {dict.profile.networkEarnings?.description ??
                            'Revisa cuánto han generado tus afiliados y transfiere tus ganancias a tu saldo personal.'}
                        </CardDescription>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/${lang}/profile/payout-settings`}>
                          {dict.profile.networkEarnings?.configure ?? 'Configuración'}
                        </Link>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {dict.wallet.balanceLabel ?? 'Available balance'}
                        </p>
                        <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                          {formatCurrency(walletBalance, lang)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {dict.profile.networkEarnings?.availableLabel ?? 'Disponible para transferir'}
                        </p>
                        <p className="text-xl font-semibold text-neutral-900 dark:text-white">
                          {formatNetworkAmount(networkTotalCents)}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                          {dict.profile.networkEarnings?.breakdownTitle ?? 'Contribuciones del equipo'}
                        </p>
                        {networkMembers.length === 0 ? (
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {dict.profile.networkEarnings?.empty ??
                              'Aún no tienes ganancias de tu equipo. Comparte tu enlace para comenzar a generar comisiones.'}
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {networkMembers.slice(0, 5).map((member) => (
                              <li
                                key={member.memberId}
                                className="flex items-center justify-between rounded-lg border border-neutral-200/60 px-3 py-2 text-sm dark:border-neutral-700/60"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-neutral-900 dark:text-white">
                                    {member.memberName ||
                                      member.memberEmail ||
                                      dict.profile.networkEarnings?.unknownMember ||
                                      'Miembro del equipo'}
                                  </span>
                                  {member.memberName && member.memberEmail && (
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{member.memberEmail}</span>
                                  )}
                                </div>
                                <span className="font-semibold text-neutral-900 dark:text-white">
                                  {formatNetworkAmount(member.totalCents)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Phase Rewards - Only visible for MLM subscriptions */}
                {isMLMSubscription && !error && phaseRewardsLoaded && canViewMonthlyRewards && (
                  <PhaseRewardsSection
                    rewards={phaseRewards}
                    currentPhase={membershipPhase}
                    lang={lang}
                    dict={phaseRewardsDict}
                    userId={userId}
                    onRewardsUpdate={loadSummary}
                    configurations={phaseRewardConfigurations}
                  />
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>{referralSettingsDict?.title ?? 'Affiliate link'}</CardTitle>
                    <CardDescription>
                      {referralSettingsDict?.description ?? 'Customize the referral code you share with prospects.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReferralSettingsForm
                      lang={lang}
                      userId={userId}
                      initialReferralCode={referralCode}
                      shareCodeFallback={referralShareFallback}
                      referralSettingsDict={referralSettingsDict}
                      affiliateDict={{
                        title: referralSettingsDict?.title ?? 'Affiliate link',
                        copy: referralSettingsDict?.copy ?? 'Copy link',
                        copied: referralSettingsDict?.copied ?? 'Copied!',
                      }}
                      inputId="referral-code"
                      appearance="dashboard"
                      className="mt-4"
                      onReferralCodeChange={setReferralCode}
                      onProfileUpdate={(payload) => {
                        if (!payload) {
                          return;
                        }
                        setSummary((prev) => (prev ? applyProfileSummaryPatch(prev, payload) : prev));
                      }}
                      onCopyError={({ title, description }) => {
                        toast({
                          title,
                          description,
                          variant: 'destructive',
                        });
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Team Messages Tab - Only visible for MLM subscriptions */}
            {isMLMSubscription && (
              <TabsContent value="messages" className="mt-10">
                <TeamMessagesInbox
                  lang={lang}
                  copy={profileMessagesDict}
                  onUnreadCountChange={setUnreadMessageCount}
                />
              </TabsContent>
            )}

            <TabsContent value="orders" className="mt-10">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">{dict.profile.orderHistory.title}</h2>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{dict.profile.orderHistory.description}</p>
              </div>

              <div className="mb-6 flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400">
                      search
                    </span>
                    <Input
                      value={orderQuery}
                      onChange={(event) => setOrderQuery(event.target.value)}
                      className="h-12 w-full rounded-lg bg-white pl-10 pr-4 text-zinc-900 placeholder:text-zinc-500 focus:ring-2 focus:ring-primary dark:bg-zinc-900/50 dark:text-white dark:placeholder:text-zinc-400"
                      placeholder={dict.profile.orderHistory.searchPlaceholder}
                      type="text"
                    />
                  </div>
                  <div className="flex gap-2">
                    {archivedOrdersCount > 0 && (
                      <Button
                        onClick={() => {
                          setShowArchivedOrders(!showArchivedOrders);
                          setSelectedOrders([]);
                        }}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <span className="material-symbols-outlined mr-2">
                          {showArchivedOrders ? 'inventory_2' : 'archive'}
                        </span>
                        {showArchivedOrders ? 'Show Active Orders' : `View Archived (${archivedOrdersCount})`}
                      </Button>
                    )}
                    {selectedOrders.length > 0 && (
                      <Button
                        onClick={showArchivedOrders ? handleUnarchiveOrders : handleArchiveOrders}
                        disabled={archivingOrders || unarchivingOrders}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <span className="material-symbols-outlined mr-2">
                          {archivingOrders || unarchivingOrders ? 'hourglass_empty' : showArchivedOrders ? 'unarchive' : 'archive'}
                        </span>
                        {archivingOrders
                          ? 'Archiving...'
                          : unarchivingOrders
                          ? 'Unarchiving...'
                          : showArchivedOrders
                          ? `Unarchive ${selectedOrders.length} Selected`
                          : `Archive ${selectedOrders.length} Selected`}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900/50">
                <div className="overflow-x-auto">
                  <Table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-300">
                    <TableHeader className="bg-zinc-50 text-xs uppercase text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                      <TableRow>
                        <TableHead className="px-6 py-3">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all orders"
                          />
                        </TableHead>
                        <TableHead className="px-6 py-3">{dict.profile.orderHistory.table.date}</TableHead>
                        <TableHead className="px-6 py-3">{dict.profile.orderHistory.table.amount}</TableHead>
                        <TableHead className="px-6 py-3">{dict.profile.orderHistory.table.productSubscription}</TableHead>
                        <TableHead className="px-6 py-3 text-center">{dict.profile.orderHistory.table.status}</TableHead>
                        <TableHead className="px-6 py-3 text-left">{dict.profile.orderHistory.table.tracking}</TableHead>
                        <TableHead className="px-6 py-3 text-center">{dict.profile.orderHistory.table.invoice}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="px-6 py-6 text-center text-zinc-500 dark:text-zinc-400">
                            {dict.profile.orderHistory.empty}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredOrders.map((order) => {
                        const products = order.items.length
                          ? order.items
                            .map((item) => `${item.name ?? '—'} ×${item.qty}`)
                            .join(', ')
                          : dict.profile.orderHistory.subscriptionFallback;
                        const statusKey = order.tracking?.latestStatus ?? order.status;
                        const statusLabel = orderStatusDict?.[statusKey as keyof typeof orderStatusDict] ?? statusKey;
                        const isLoadingInvoice = loadingInvoiceId === order.id;
                        return (
                          <TableRow key={order.id} className="border-b border-black/10 dark:border-white/10">
                            <TableCell className="px-6 py-4">
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                                aria-label={`Select order ${order.id}`}
                              />
                            </TableCell>
                            <TableCell className="px-6 py-4">{formatDate(order.created_at, lang)}</TableCell>
                            <TableCell className="px-6 py-4">{formatCurrency(order.total_cents, lang)}</TableCell>
                            <TableCell className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{products}</TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <Badge className="bg-primary/20 text-green-800 dark:text-green-300">{statusLabel}</Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              {order.tracking ? (
                                <div className="space-y-1 text-left text-xs text-zinc-600 dark:text-zinc-300">
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                                    {orderStatusDict?.[order.tracking.latestStatus as keyof typeof orderStatusDict] ??
                                      order.tracking.latestStatus}
                                  </Badge>
                                  {order.tracking.updated_at && (
                                    <p>{dict.profile.orderHistory.tracking.updated.replace('{{value}}', formatDateTime(order.tracking.updated_at, lang))}</p>
                                  )}
                                  {order.tracking.responsible_company && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile.orderHistory.tracking.company}:
                                      </span>{' '}
                                      {order.tracking.responsible_company}
                                    </p>
                                  )}
                                  {order.tracking.tracking_code && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile.orderHistory.tracking.code}:
                                      </span>{' '}
                                      {order.tracking.tracking_code}
                                    </p>
                                  )}
                                  {order.tracking.location && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile.orderHistory.tracking.location}:
                                      </span>{' '}
                                      {order.tracking.location}
                                    </p>
                                  )}
                                  {order.tracking.estimated_delivery && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile.orderHistory.tracking.eta}:
                                      </span>{' '}
                                      {formatDate(order.tracking.estimated_delivery, lang)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                                  {dict.profile.orderHistory.tracking.empty}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoadingInvoice}
                                onClick={() => handleViewInvoice(order.id)}
                                className="text-xs"
                              >
                                {isLoadingInvoice
                                  ? dict.profile.orderHistory.loadingInvoice
                                  : dict.profile.orderHistory.viewInvoice}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </main>
        <Dialog open={Boolean(invoiceViewer)} onOpenChange={handleInvoiceViewerChange}>
          <DialogContent className="flex h-[80vh] w-[min(100vw-2rem,960px)] flex-col gap-4">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                <span>{dict.profile.orderHistory.table.invoice}</span>
                {invoiceViewer?.orderId ? (
                  <span className="text-sm font-medium text-muted-foreground">
                    #{invoiceViewer.orderId.slice(0, 8).toUpperCase()}
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription>{dict.profile.orderHistory.invoiceViewerHint}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden rounded-xl border border-border/60 bg-background">
              {invoiceViewer ? (
                <iframe
                  title={`invoice-${invoiceViewer.orderId}`}
                  srcDoc={invoiceViewer.html}
                  className="h-full w-full bg-white"
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </>
    </AuthGuard>
  );
}
