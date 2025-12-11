"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { getSafeSession } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import type {
  NetworkLevelSnapshot,
  NetworkMember,
  SubscriptionSummary,
} from '@/modules/multilevel/domain/types';
import { ReferralSettingsForm as _ReferralSettingsForm } from '@/modules/referrals/ui/referral-settings-form';
import { UserProfileProvider } from '@/contexts/user-profile-context';

type DashboardContentProps = {
  lang: Locale;
  dict: any;
};

type PlanPhase = {
  key: string;
  title: string;
  helper: string;
  requirements: string[];
  rewards: string[];
  requirementsLabel: string;
  rewardsLabel: string;
};


const formatCurrency = (value: number, locale: Locale) => {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value / 100);
};

const formatPhaseLabel = (phase: number | undefined, label: string) => {
  if (phase === undefined || phase === null) return `${label} 0`;
  return `${label} ${phase}`;
};

const formatDate = (value: string | null, locale: Locale) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch (error) {
    console.error('Failed to format date', error);
    return value;
  }
};

const replacePlanPriceTokens = (text: string, planPrice: number | null) => {
  if (!text) {
    return text;
  }

  if (!planPrice) {
    return text;
  }

  const formattedPrice = `$${planPrice.toFixed(2)}`;
  return text
    .replace(/\$34(\.00)?/g, formattedPrice)
    .replace(/\{\{price\}\}/g, formattedPrice);
};

const phaseValues = {
  phase0: { commission: 8, productValue: 0, walletCredit: 0 },
  phase1: { commission: 15, productValue: 65, walletCredit: 3 },
  phase2: { commission: 30, productValue: 125, walletCredit: 9 },
  phase3: { commission: 40, productValue: 240, walletCredit: 506 },
};

const replacePhaseTokens = (text: string, key: 'phase0' | 'phase1' | 'phase2' | 'phase3') => {
  const values = phaseValues[key];
  return text
    .replace(/\{\{commission\}\}/g, values.commission.toString())
    .replace(/\{\{productValue\}\}/g, values.productValue.toString())
    .replace(/\{\{walletCredit\}\}/g, values.walletCredit.toString());
};

// Plan type for current user's plan
type UserPlan = {
  id: string;
  name: string;
  price: number;
  is_mlm_plan: boolean;
  is_affiliate_plan: boolean;
};

// Batched state type for optimized rendering
type DashboardState = {
  summary: SubscriptionSummary | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  referralCode: string | null;
  planPrice: number | null;
  currentPlan: UserPlan | null;
  plans: UserPlan[];
  userName: string | null;
  userProfile: unknown | null;
  affiliateCommissionRate: number;
  affiliateCommissionType: 'fixed' | 'percent';
};

export default function DashboardContent({ lang, dict }: DashboardContentProps) {
  const dashboardDict = dict.dashboard?.home;
  const summaryDict = dashboardDict?.summary;
  const noSubscriptionDict = dashboardDict?.noSubscription;
  const accountOverviewDict = dashboardDict?.accountOverview;
  const affiliateStoreDict = dashboardDict?.affiliateStore;
  const _referralSettingsDict = dict.profile?.referralSettings;

  // Optimized: Single state object to batch all updates and reduce re-renders
  // This eliminates multiple setState calls that could appear as N+1 in monitoring
  const [state, setState] = useState<DashboardState>({
    summary: null,
    userId: null,
    loading: true,
    error: null,
    referralCode: null,
    planPrice: null,
    currentPlan: null,
    plans: [],
    userName: null,
    userProfile: null,
    affiliateCommissionRate: 0, // Will be updated from API (configured in admin)
    affiliateCommissionType: 'percent', // Will be updated from API
  });

  // Destructure for backward compatibility with existing code
  const { summary, userId, loading, error, referralCode, planPrice, currentPlan, userName, userProfile, affiliateCommissionRate, affiliateCommissionType } = state;


  // OPTIMIZED: Single API call to consolidated endpoint
  // This eliminates the N+1 API call pattern detected by Sentry
  // by fetching all dashboard data (profile, plans, summary) in one request
  useEffect(() => {
    let ignore = false;

    const initializeDashboard = async () => {
      try {
        // Set loading state
        setState(prev => ({ ...prev, loading: true }));

        // First, get the session to extract userId
        const sessionResult = await getSafeSession();

        if (ignore) return;

        const session = sessionResult.data.session;
        if (!session?.user?.id) {
          throw new Error('Missing authenticated user');
        }

        const userId = session.user.id;

        // SINGLE API CALL: Fetch all dashboard data at once
        // This replaces the previous 3 parallel calls with 1 consolidated call
        const response = await fetch('/api/dashboard/init', {
          cache: 'no-store',
          credentials: 'same-origin', // Include cookies for authentication
        });

        if (ignore) return;

        if (!response.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const data = await response.json();

        // Find the current user's plan based on subscription
        const plans = data.plans ?? [];
        const userPlanId = data.summary?.subscription?.plan_id;
        const currentPlan = userPlanId 
          ? plans.find((p: UserPlan) => p.id === userPlanId) ?? null 
          : null;

        // OPTIMIZED: Single batched state update
        // All data comes from one API response, eliminating N+1 pattern
        if (!ignore) {
          setState({
            userId,
            userProfile: data.profile,
            referralCode: data.profile?.referral_code ?? null,
            userName: data.profile?.name ?? null,
            planPrice: data.planPrice,
            currentPlan,
            plans,
            summary: data.summary,
            affiliateCommissionRate: (typeof data.affiliateCommissionRate === 'number' && !Number.isNaN(data.affiliateCommissionRate)) 
              ? data.affiliateCommissionRate 
              : 0,
            affiliateCommissionType: data.affiliateCommissionType || 'percent',
            error: null,
            loading: false,
          });
        }
      } catch (error) {
        if (!ignore) {
          console.error('Failed to initialize dashboard:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          setState(prev => ({
            ...prev,
            error: message,
            loading: false,
          }));
        }
      }
    };

    initializeDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  // Separate refresh function for manual refresh
  const handleRefresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await fetch('/api/dashboard/summary', {
        cache: 'no-store',
        credentials: 'same-origin', // Include cookies for authentication
      });

      if (!response.ok) {
        throw new Error('Failed to load dashboard summary');
      }

      const payload = (await response.json()) as SubscriptionSummary;

      // OPTIMIZED: Batched state update
      setState(prev => ({
        ...prev,
        summary: payload,
        error: null,
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: message,
        loading: false,
      }));
    }
  }, [userId]);


  const phaseLabelText = summaryDict.cards.phase.label ?? 'Phase';
  const subscriptionStatus = summary?.subscription?.status ?? null;
  const hasActiveSubscription = subscriptionStatus === 'active';
  // Only determine subscription type if there's an active subscription
  const subscriptionType = hasActiveSubscription 
    ? ((summary?.subscription as any)?.subscription_type ?? 'mlm')
    : null;
  const isMlmSubscription = hasActiveSubscription && subscriptionType === 'mlm';
  const isAffiliateSubscription = hasActiveSubscription && subscriptionType === 'affiliate';
  const commissionRate = hasActiveSubscription ? summary?.phase?.ecommerce_commission ?? 0 : null;
  const currentPhase = summary?.phase?.phase ?? (hasActiveSubscription ? 0 : null);
  const planDict = dict.teams?.plan;
  const planDescription = replacePlanPriceTokens(
    summaryDict.phaseBenefits?.description ?? planDict?.description ?? '',
    planPrice,
  );
  const planEmptyMessage = replacePlanPriceTokens(
    summaryDict.phaseBenefits?.empty ?? '',
    planPrice,
  );

  const numberFormatter = useMemo(() => new Intl.NumberFormat(lang), [lang]);
  const networkOverviewDict = summaryDict?.networkOverview;
  const networkOverview = summary?.network ?? null;
  const networkSectionState: 'loading' | 'empty' | 'ready' = useMemo(() => {
    if (!networkOverview) {
      return loading ? 'loading' : 'empty';
    }

    if (networkOverview.totalMembers === 0) {
      return 'empty';
    }

    return 'ready';
  }, [loading, networkOverview]);

  const networkMetrics = useMemo(
    () => {
      const totals = networkOverview ?? {
        totalMembers: 0,
        activeMembers: 0,
        inactiveMembers: 0,
      };

      const labels = networkOverviewDict?.metrics ?? {};

      return [
        {
          key: 'total',
          label: labels.total ?? 'Total partners',
          value: numberFormatter.format(totals.totalMembers),
          className: 'text-slate-900 dark:text-white',
        },
        {
          key: 'active',
          label: labels.active ?? 'Active partners',
          value: numberFormatter.format(totals.activeMembers),
          className: 'text-emerald-600 dark:text-emerald-300',
        },
        {
          key: 'inactive',
          label: labels.inactive ?? 'Needs attention',
          value: numberFormatter.format(totals.inactiveMembers),
          className: 'text-rose-600 dark:text-rose-300',
        },
      ];
    },
    [networkOverview, networkOverviewDict, numberFormatter],
  );

  const displayedNetworkMembers = useMemo<NetworkMember[]>(() => {
    if (!networkOverview) {
      return [];
    }

    // Waitlisted members are already filtered out in tree-service.ts
    return networkOverview.members.slice(0, 6);
  }, [networkOverview]);

  const unlockedPhases = useMemo<PlanPhase[]>(() => {
    if (!planDict?.phases) {
      return [];
    }

    const phases: PlanPhase[] = [];

    const pushPhase = (key: 'phase0' | 'phase1' | 'phase2' | 'phase3') => {
      const phaseDict = planDict.phases?.[key];
      if (!phaseDict) return;
      phases.push({
        key,
        title: replacePlanPriceTokens(phaseDict.title ?? '', planPrice),
        helper: replacePlanPriceTokens(phaseDict.helper ?? '', planPrice),
        requirements:
          ((phaseDict.requirements as string[]) ?? []).map((item) =>
            replacePlanPriceTokens(item, planPrice),
          ),
        rewards:
          ((phaseDict.rewards as string[]) ?? []).map((item) =>
            replacePlanPriceTokens(replacePhaseTokens(item, key), planPrice),
          ),
        requirementsLabel: replacePlanPriceTokens(
          planDict.requirements ?? 'Requirements',
          planPrice,
        ),
        rewardsLabel: replacePlanPriceTokens(planDict.rewards ?? 'Benefits', planPrice),
      });
    };

    if (hasActiveSubscription) {
      pushPhase('phase0');
    }

    if (typeof currentPhase === 'number') {
      if (currentPhase >= 1) {
        pushPhase('phase1');
      }
      if (currentPhase >= 2) {
        pushPhase('phase2');
      }
      if (currentPhase >= 3) {
        pushPhase('phase3');
      }
    }

    return phases;
  }, [planDict?.phases, planDict?.requirements, planDict?.rewards, hasActiveSubscription, currentPhase, planPrice]);


  if (!dashboardDict || !summaryDict) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#f6f8f6] text-slate-500 dark:bg-[#0b1910] dark:text-slate-300">
        <p>Dashboard copy is missing in the translation dictionary.</p>
      </div>
    );
  }

  const subscriptionStatusForLabel = summary?.subscription?.status ?? 'unpaid';
  const statusKeyMap: Record<string, 'active' | 'pastDue' | 'unpaid' | 'canceled'> = {
    active: 'active',
    past_due: 'pastDue',
    unpaid: 'unpaid',
    canceled: 'canceled',
  };
  const statusKey = statusKeyMap[subscriptionStatusForLabel] ?? 'unpaid';
  const statusLabel = summaryDict.cards.subscription[statusKey];

  return (
    <UserProfileProvider initialProfile={userProfile as any} autoLoad={false}>
      <div className="min-h-screen bg-[#f6f8f6] text-slate-900 dark:bg-[#0b1910] dark:text-slate-100" data-lang={lang}>
      <main className="px-4 py-10 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-6xl space-y-10">
          <section className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold">{dict.dashboard.title}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {userName
                  ? dashboardDict.welcome.replace('{{userName}}', userName)
                  : dashboardDict.welcome.replace(', {{userName}}', '')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="min-h-[40px]"
            >
              {loading ? '⟳' : '↻'} {dict.dashboard?.refresh ?? 'Refresh'}
            </Button>
          </section>

          {/* No Active Subscription Banner */}
          {!loading && !hasActiveSubscription && (
            <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm dark:border-amber-500/50 dark:bg-amber-900/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800/50">
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                      {noSubscriptionDict?.title}
                    </h2>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {noSubscriptionDict?.description}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  <Link href={`/${lang}/subscription`} className="w-full sm:w-auto">
                    <Button className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600">
                      {noSubscriptionDict?.viewPlans}
                    </Button>
                  </Link>
                  <Link href={`/${lang}/products`} className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-800/30">
                      {noSubscriptionDict?.goToShop}
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          )}

          <section className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${isMlmSubscription ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            {/* Phase card - Only for MLM subscriptions */}
            {isMlmSubscription && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{summaryDict.cards.phase.title}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {formatPhaseLabel(summary?.phase?.phase, phaseLabelText)}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{summaryDict.cards.commission.title}</p>
              {hasActiveSubscription ? (
                <>
                  <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-300">
                    {isMlmSubscription 
                      ? `${Math.round((commissionRate ?? 0) * 100)}%`
                      : affiliateCommissionType === 'percent'
                        ? `${Math.round((Number.isFinite(affiliateCommissionRate) ? affiliateCommissionRate : 0) * 100)}%`
                        : formatCurrency(Number.isFinite(affiliateCommissionRate) ? affiliateCommissionRate : 0, lang)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {isMlmSubscription 
                      ? summaryDict.cards.commission.helper
                      : affiliateCommissionType === 'percent'
                        ? 'Por cada venta en tu tienda'
                        : 'Ganancia fija por venta'}
                  </p>
                </>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    {summaryDict.cards.commission.lockedTitle ?? summaryDict.phaseBenefits?.empty}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {planPrice
                      ? (summaryDict.cards.commission.lockedDescription ?? '').replace(
                        /\$\d+(\.\d{2})?/g,
                        `$${planPrice.toFixed(2)}`
                      )
                      : summaryDict.cards.commission.lockedDescription}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{summaryDict.cards.wallet.title}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {summary?.wallet ? formatCurrency(summary.wallet.balance_cents, lang) : '$0.00'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{summaryDict.cards.subscription.title}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{statusLabel}</p>
              {hasActiveSubscription && (
                <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {isMlmSubscription ? '🌐 Red Multinivel' : '🛒 Afiliado'}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {summaryDict.cards.subscription.nextCharge}: {formatDate(summary?.subscription?.current_period_end ?? null, lang)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isMlmSubscription 
                ? accountOverviewDict?.mlmEarnings
                : isAffiliateSubscription 
                  ? accountOverviewDict?.affiliateEarnings
                  : accountOverviewDict?.title}
            </h2>
            {/* Grid: 3 columns for MLM (with phase commission), 2 columns for Affiliate/No subscription */}
            <div className={`mt-6 grid grid-cols-1 gap-4 ${isMlmSubscription ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
                  {accountOverviewDict?.currentBalance}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {summary?.wallet ? formatCurrency(summary.wallet.balance_cents, lang) : '$0.00'}
                </p>
              </div>
              {/* Phase Commission card - Only for MLM subscriptions */}
              {isMlmSubscription && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
                    {accountOverviewDict?.phaseCommission}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                    {Math.round((commissionRate ?? 0) * 100)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {accountOverviewDict?.phase} {summary?.phase?.phase ?? 0}
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
                  {hasActiveSubscription 
                    ? (isMlmSubscription ? accountOverviewDict?.mlmSubscription : accountOverviewDict?.affiliateSubscription)
                    : accountOverviewDict?.subscriptionStatus}
                </p>
                {currentPlan ? (
                  <>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(currentPlan.price * 100, lang)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {currentPlan.name}
                    </p>
                  </>
                ) : (
                  <div className="mt-2">
                    <p className="text-lg font-medium text-amber-600 dark:text-amber-400">
                      {noSubscriptionDict?.noActiveSubscription}
                    </p>
                    <Link href={`/${lang}/subscription`} className="mt-2 inline-block text-sm text-primary hover:underline">
                      {noSubscriptionDict?.viewAvailablePlans}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </section>


          {/* Network Overview - Only shown for MLM subscriptions */}
          {isMlmSubscription && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {networkOverviewDict?.title ?? 'Network overview'}
                  </h2>
                  {networkOverviewDict?.helper && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {networkOverviewDict.helper}
                    </p>
                  )}
                </div>
              </div>

              {networkSectionState === 'loading' && (
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">
                  {networkOverviewDict?.loading ?? 'Loading your network metrics...'}
                </p>
              )}

              {networkSectionState === 'empty' && !loading && (
                <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {networkOverviewDict?.empty ?? 'Invite your first referrals to see network insights here.'}
                </p>
              )}

              {networkSectionState === 'ready' && networkOverview && (
                <>
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {networkMetrics.map((metric) => (
                      <div
                        key={metric.key}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{metric.label}</p>
                        <p className={`mt-2 text-2xl font-bold ${metric.className}`}>{metric.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {networkOverview.levels.map((snapshot) => (
                          <NetworkLevelCard
                            key={snapshot.level}
                            snapshot={snapshot}
                            dict={networkOverviewDict}
                            formatter={numberFormatter}
                          />
                        ))}
                      </div>
                    </div>

                    <NetworkMemberList dict={networkOverviewDict} members={displayedNetworkMembers} />
                  </div>
                </>
              )}
            </section>
          )}

          {/* Affiliate Store Info - Only shown for Affiliate subscriptions */}
          {isAffiliateSubscription && hasActiveSubscription && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    🛒 {affiliateStoreDict?.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {affiliateStoreDict?.description}
                  </p>
                </div>
              </div>
              
              {referralCode && (
                <div className="mt-6 space-y-4">
                  {/* Store Link */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-300 mb-2">
                      {affiliateStoreDict?.storeLink}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/${lang}/affiliate/${referralCode}` : `/${lang}/affiliate/${referralCode}`}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/${lang}/affiliate/${referralCode}`;
                          navigator.clipboard.writeText(url);
                        }}
                      >
                        {affiliateStoreDict?.copy}
                      </Button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={() => window.open(`/${lang}/affiliate/${referralCode}`, '_blank')}
                    >
                      👁️ {affiliateStoreDict?.viewStore}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.location.href = `/${lang}/affiliate/${referralCode}/settings/store`}
                    >
                      🎨 {affiliateStoreDict?.customize}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.location.href = `/${lang}/affiliate/${referralCode}/analytics`}
                    >
                      📊 {affiliateStoreDict?.analytics}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="text-sm text-emerald-700 dark:text-emerald-200">
                  ✅ {affiliateStoreDict?.activeMessage}
                </p>
              </div>
            </section>
          )}

          {/* Phase Benefits - Only for MLM subscriptions */}
          {planDict && summary?.subscription?.status === 'active' && isMlmSubscription && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {summaryDict.phaseBenefits?.title ?? planDict.title ?? 'Unlocked benefits'}
              </h2>
              {planDescription && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{planDescription}</p>
              )}

              {unlockedPhases.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  {planEmptyMessage}
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {unlockedPhases.map((phase) => (
                    <PhaseSummaryCard key={phase.key} phase={phase} planPrice={planPrice} />
                  ))}
                </div>
              )}
            </section>
          )}

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {summaryDict.loading}
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              {summaryDict.error}
            </div>
          )}
        </div>
      </main>
      </div>
    </UserProfileProvider>
  );
}


function PhaseSummaryCard({ phase, planPrice }: { phase: PlanPhase; planPrice: number | null }) {
  const processRewardText = (text: string) => replacePlanPriceTokens(text, planPrice);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-transparent">
      <header>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{phase.title}</h3>
        {phase.helper && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{phase.helper}</p>}
      </header>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {phase.requirements.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              {phase.requirementsLabel}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {phase.requirements.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                  <span>{processRewardText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {phase.rewards.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              {phase.rewardsLabel}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {phase.rewards.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                  <span>{processRewardText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

type NetworkLevelCardProps = {
  snapshot: NetworkLevelSnapshot;
  dict: any;
  formatter: Intl.NumberFormat;
};

function NetworkLevelCard({ snapshot, dict, formatter }: NetworkLevelCardProps) {
  const headingTemplate = dict?.level?.heading as string | undefined;
  const activeLabel = dict?.level?.active ?? 'Active';
  const inactiveLabel = dict?.level?.inactive ?? 'Needs attention';
  const title = headingTemplate
    ? headingTemplate.replace('{{level}}', snapshot.level.toString())
    : `Level ${snapshot.level}`;
  const progress = snapshot.total > 0 ? Math.round((snapshot.active / snapshot.total) * 100) : 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-transparent">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        <span className="text-slate-500 dark:text-slate-400">
          {formatter.format(snapshot.active)}/{formatter.format(snapshot.total)}
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-white/10">
        <div
          className={`h-2 rounded-full bg-emerald-500 transition-all duration-500 ease-out dark:bg-emerald-300 progress-bar`}
          data-progress={progress}
        />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
        <div>
          <dt className="font-medium uppercase tracking-wide">{activeLabel}</dt>
          <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
            {formatter.format(snapshot.active)}
          </dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-wide">{inactiveLabel}</dt>
          <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
            {formatter.format(snapshot.inactive)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

type NetworkMemberListProps = {
  dict: any;
  members: NetworkMember[];
};

function NetworkMemberList({ dict, members }: NetworkMemberListProps) {
  const heading = dict?.members?.title ?? 'Recent referrals';
  const emptyCopy = dict?.members?.empty ?? 'You have not enrolled any partners yet.';
  const phaseTemplate = dict?.members?.phase as string | undefined;
  const phaseUnknown = dict?.members?.phaseUnknown ?? 'Phase pending';
  const statusDict = dict?.members?.status ?? {};
  const levelTemplate = dict?.level?.heading as string | undefined;

  return (
    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{heading}</h3>

      {members.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{emptyCopy}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {members.map((member) => {
            const levelLabel = levelTemplate
              ? levelTemplate.replace('{{level}}', member.level.toString())
              : `Level ${member.level}`;
            const phaseLabel =
              typeof member.phase === 'number'
                ? (phaseTemplate ?? 'Phase {{phase}}').replace('{{phase}}', member.phase.toString())
                : phaseUnknown;

            return (
              <li
                key={member.id}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-transparent"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {member.email || '—'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{phaseLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-white text-xs text-slate-600 dark:border-white/20 dark:bg-white/10 dark:text-slate-200"
                    >
                      {levelLabel}
                    </Badge>
                    <StatusBadge status={member.statusCategory} labelMap={statusDict} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

type StatusBadgeProps = {
  status: NetworkMember['statusCategory'];
  labelMap: Record<string, string>;
};

function StatusBadge({ status, labelMap }: StatusBadgeProps) {
  const label = labelMap?.[status] ?? status;
  const toneClass =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200';

  return <Badge className={`text-xs font-semibold ${toneClass}`}>{label}</Badge>;
}



