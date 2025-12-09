'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { getSafeSession } from '@/lib/supabase';
import { getPlans } from '@/lib/services/plan-service';
import { AppSettingsSchema, type AppSettings } from '@/modules/app-settings/domain/models/app-settings';
import { TeamMessageComposer } from '@/modules/team-messaging/ui/team-message-composer';
import type { TeamMessageComposerCopy } from '@/modules/team-messaging/ui/team-message-composer';

interface TeamsContentProps {
  lang: Locale;
  dict: any;
}

interface TreeMember {
  id: string;
  email: string;
  name: string | null;
  status: string | null;
  phase: number | null;
  level: number;
  allowTeamMessages?: boolean;
}

interface TreeResponse {
  // New multilevel format
  levels?: Record<number, TreeMember[]>;
  maxLevel?: number;
  // Legacy format for backward compatibility
  level1: TreeMember[];
  level2: TreeMember[];
}

interface SummaryResponse {
  phase: {
    phase: number;
    phase2_achieved_at: string | null;
  } | null;
  subscription: {
    status: string;
    waitlisted: boolean;
  } | null;
}

const statusOrder = ['active', 'past_due', 'unpaid', 'canceled', 'waitlisted'] as const;

type StatusKey = (typeof statusOrder)[number];

const DEFAULT_LEVEL_TARGETS = {
  1: 2,
  2: 4,
} as const;

const DEFAULT_TEAM_LEVELS_VISIBLE = 2;

const DEFAULT_MESSAGING_COPY: TeamMessageComposerCopy = {
  action: 'Message {{email}}',
  actionAria: 'Send a message to {{email}}',
  dialog: {
    title: 'Message {{email}}',
    bodyLabel: 'Write a short note to stay connected with your team.',
    placeholder: 'Say hello and coordinate next steps…',
    cancel: 'Cancel',
    send: 'Send message',
    sending: 'Sending…',
    successTitle: 'Message sent',
    successDescription: 'Your teammate will receive this message instantly.',
    errorTitle: 'Unable to send message',
    errorDescription: 'Please try again in a few moments.',
    validationError: 'Enter a message before sending.',
  },
};

export default function TeamsContent({ lang, dict }: TeamsContentProps) {
  const teamsDict = dict.teams;
  const summaryDict = dict.dashboard?.home?.summary;
  const messagingCopy = useMemo(() => {
    const overrides = teamsDict?.messaging ?? {};
    return {
      ...DEFAULT_MESSAGING_COPY,
      ...overrides,
      dialog: {
        ...DEFAULT_MESSAGING_COPY.dialog,
        ...(overrides.dialog ?? {}),
      },
    } satisfies TeamMessageComposerCopy;
  }, [teamsDict?.messaging]);

  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_userId, setUserId] = useState<string | null>(null);
  const [planPrice, setPlanPrice] = useState<number | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [phaseLevels, setPhaseLevels] = useState<any[]>([]);



  // Optimized: Single useEffect to load all teams data in parallel
  useEffect(() => {
    let ignore = false;

    const initializeTeams = async () => {
      try {
        setLoading(true);

        // Execute ALL initial API calls in parallel to avoid N+1 problem
        const [sessionResult, plansResult, appSettingsResult, phaseLevelsResult] = await Promise.all([
          getSafeSession(),
          getPlans().catch(err => {
            console.error('Failed to fetch plan price:', err);
            return [];
          }),
          fetch('/api/app-settings', { cache: 'no-store' }).catch(err => {
            console.error('Failed to fetch app settings:', err);
            return null;
          }),
          fetch('/api/public/phase-levels', { cache: 'no-store' }).catch(err => {
            console.error('Failed to fetch phase levels:', err);
            return null;
          })
        ]);

        if (ignore) return;

        const session = sessionResult.data.session;
        if (!session?.user?.id) {
          throw new Error('Missing authenticated user');
        }

        const userId = session.user.id;
        setUserId(userId);

        // Set plan price
        if (plansResult.length > 0) {
          const lowestPricePlan = plansResult.reduce((min, plan) => plan.price < min.price ? plan : min, plansResult[0]);
          setPlanPrice(lowestPricePlan.price);
        }

        // Set app settings
        if (appSettingsResult && appSettingsResult.ok) {
          const payload = (await appSettingsResult.json()) as { settings?: unknown };
          const parsed = AppSettingsSchema.safeParse(payload.settings);
          if (parsed.success) {
            setAppSettings(parsed.data);
          } else {
            setAppSettings(null);
          }
        } else {
          setAppSettings(null);
        }

        // Set phase levels
        if (phaseLevelsResult && phaseLevelsResult.ok) {
          const payload = await phaseLevelsResult.json();
          setPhaseLevels(payload.phaseLevels ?? []);
        } else {
          setPhaseLevels([]);
        }

        // Load tree and summary data - these endpoints use session authentication
        const [treeRes, summaryRes] = await Promise.all([
          fetch('/api/tree', {
            cache: 'no-store',
            credentials: 'same-origin' // Include cookies for authentication
          }),
          fetch('/api/dashboard/summary', {
            cache: 'no-store',
            credentials: 'same-origin' // Include cookies for authentication
          }),
        ]);

        console.log('[Teams Debug] API responses:', {
          treeOk: treeRes.ok,
          treeStatus: treeRes.status,
          summaryOk: summaryRes.ok,
          summaryStatus: summaryRes.status,
        });

        if (!treeRes.ok) {
          const errorData = await treeRes.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[Teams Debug] Tree API error:', errorData);
          throw new Error(`Failed to load team tree: ${JSON.stringify(errorData)}`);
        }
        if (!summaryRes.ok) {
          const errorData = await summaryRes.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[Teams Debug] Summary API error:', errorData);
          throw new Error(`Failed to load summary: ${JSON.stringify(errorData)}`);
        }

        const treePayload = (await treeRes.json()) as TreeResponse;
        const summaryPayload = (await summaryRes.json()) as SummaryResponse;

        console.log('[Teams Debug] Tree data loaded:', {
          treePayload,
          hasLevels: !!treePayload.levels,
          level1Count: treePayload.level1?.length ?? 0,
          level2Count: treePayload.level2?.length ?? 0,
          levelsKeys: treePayload.levels ? Object.keys(treePayload.levels) : [],
          maxLevel: treePayload.maxLevel,
        });

        console.log('[Teams Debug] Summary data loaded:', {
          summaryPayload,
          subscriptionStatus: summaryPayload?.subscription?.status,
          phase: summaryPayload?.phase?.phase,
        });

        if (!ignore) {
          setTree(treePayload);
          setSummary(summaryPayload);
          setError(null);
        }
      } catch (_err) {
        if (!ignore) {
          const message = _err instanceof Error ? _err.message : 'Unknown error';
          console.error('[Teams Debug] Error loading team data:', _err);
          console.error('[Teams Debug] Error details:', {
            message,
            error: _err,
          });
          setError(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    initializeTeams();

    return () => {
      ignore = true;
    };
  }, []);

  // All hooks must be called before any conditional returns
  const statusPriority = useMemo(() => {
    return statusOrder.reduce<Record<StatusKey, number>>((acc, status, index) => {
      acc[status] = index;
      return acc;
    }, {} as Record<StatusKey, number>);
  }, []);

  const sortMembers = useCallback(
    (members: TreeMember[]) => {
      return [...members].sort((a, b) => {
        const statusA = (a.status ?? 'unpaid') as StatusKey;
        const statusB = (b.status ?? 'unpaid') as StatusKey;
        const priorityA = statusPriority[statusA] ?? statusOrder.length;
        const priorityB = statusPriority[statusB] ?? statusOrder.length;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
      });
    },
    [statusPriority],
  );

  // Support both legacy and new multilevel format
  const membersByLevel = useMemo(() => {
    if (tree?.levels) {
      // New multilevel format
      const result: Record<number, TreeMember[]> = {};
      Object.entries(tree.levels).forEach(([level, members]) => {
        result[Number(level)] = sortMembers(members);
      });
      console.log('[Teams Debug] Using multilevel format:', result);
      return result;
    } else {
      // Legacy format
      const legacy = {
        1: sortMembers(tree?.level1 ?? []),
        2: sortMembers(tree?.level2 ?? []),
      };
      console.log('[Teams Debug] Using legacy format:', legacy);
      return legacy;
    }
  }, [tree, sortMembers]);

  const teamLevelsVisible = useMemo(() => {
    if (!appSettings) {
      return DEFAULT_TEAM_LEVELS_VISIBLE;
    }

    const configured = Number.parseInt(`${appSettings.teamLevelsVisible ?? DEFAULT_TEAM_LEVELS_VISIBLE}`, 10);
    if (!Number.isFinite(configured)) {
      return DEFAULT_TEAM_LEVELS_VISIBLE;
    }

    return Math.min(Math.max(configured, 1), 10);
  }, [appSettings]);

  // Legacy support
  const _level1Members = membersByLevel[1] ?? [];
  const _level2Members = membersByLevel[2] ?? [];

  const currentPhase = summary?.phase?.phase ?? null;

  // Check if user has active subscription
  const hasActiveSubscription = summary?.subscription?.status === 'active';

  // Filter levels to show only those with members, respecting teamLevelsVisible limit
  const levelsWithMembers = useMemo(() => {
    const levels: number[] = [];
    Object.entries(membersByLevel).forEach(([level, members]) => {
      const levelNum = Number(level);
      // Only show levels with members AND within the visible limit
      if (members.length > 0 && levelNum <= teamLevelsVisible) {
        levels.push(levelNum);
      }
    });
    return levels.sort((a, b) => a - b);
  }, [membersByLevel, teamLevelsVisible]);

  // Dynamic level targets from app settings
  const levelTargets = useMemo(() => {
    const targets: Record<number, number> = {
      1: DEFAULT_LEVEL_TARGETS[1],
      2: DEFAULT_LEVEL_TARGETS[2],
    };

    if (!appSettings) {
      return targets;
    }

    // Build targets from app settings
    appSettings.maxMembersPerLevel.forEach((entry) => {
      targets[entry.level] = entry.maxMembers;
    });

    return targets;
  }, [appSettings]);



  // Calculate network statistics
  const networkStats = useMemo(() => {
    let totalMembers = 0;
    let activeMembers = 0;
    let inactiveMembers = 0;
    const membersByLevelCount: Record<number, number> = {};

    Object.entries(membersByLevel).forEach(([level, members]) => {
      const levelNum = Number(level);
      totalMembers += members.length;
      membersByLevelCount[levelNum] = members.length;

      members.forEach((member) => {
        if (member.status === 'active') {
          activeMembers++;
        } else {
          inactiveMembers++;
        }
      });
    });

    return {
      totalMembers,
      activeMembers,
      inactiveMembers,
      membersByLevelCount,
    };
  }, [membersByLevel]);

  const statusBadgeDict = teamsDict.statusBadge;
  const statusClass = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
      case 'past_due':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
      case 'canceled':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200';
      default:
        return 'bg-slate-200 text-slate-600 dark:bg-slate-600/40 dark:text-slate-200';
    }
  };

  const activeLabel = (members: TreeMember[]) => {
    const activeCount = members.filter((member) => member.status === 'active').length;
    if (typeof teamsDict.activeCount === 'string') {
      return teamsDict.activeCount.replace('{{count}}', `${activeCount}`);
    }
    return `${activeCount}`;
  };

  const formatPhaseLabel = (phase: number | null) => {
    if (typeof phase !== 'number') {
      return null;
    }
    if (typeof teamsDict.phaseTag === 'string') {
      return teamsDict.phaseTag.replace('{{value}}', `${phase}`);
    }
    return `Phase ${phase}`;
  };

  const planPhases = useMemo(() => {
    const phasesDict = teamsDict.plan?.phases ?? {};
    const requirementsLabel = teamsDict.plan?.requirements ?? 'Requirements';
    const rewardsLabel = teamsDict.plan?.rewards ?? 'Benefits';

    return (
      [
        {
          key: 'phase0',
          level: 0,
          unlocked: true, // Always show phase 0 info
        },
        {
          key: 'phase1',
          level: 1,
          unlocked: typeof currentPhase === 'number' && currentPhase >= 1,
        },
        {
          key: 'phase2',
          level: 2,
          unlocked: typeof currentPhase === 'number' && currentPhase >= 2,
        },
        {
          key: 'phase3',
          level: 3,
          unlocked: typeof currentPhase === 'number' && currentPhase >= 3,
        },
      ] as const
    ).map(({ key, level, unlocked }) => {
      const phaseDict = phasesDict?.[key] ?? {};
      const phaseLevel = phaseLevels.find((pl) => pl.level === level);

      const replaceDynamicTokens = (text: string) => {
        const formattedPrice = planPrice ? `$${planPrice.toFixed(2)}` : '$34';
        let result = text
          .replace(/\$34(\.00)?/g, formattedPrice)
          .replace(/\{\{price\}\}/g, formattedPrice);

        // Replace dynamic values from phase_levels table
        if (phaseLevel) {
          // Commission rate (e.g., "8%" or "15%")
          const commissionPercent = Math.round(phaseLevel.commissionRate * 100);
          result = result.replace(/\{\{commission\}\}/g, `${commissionPercent}%`);

          // Free product value (e.g., "$65" or "$125")
          if (phaseLevel.freeProductValueCents > 0) {
            const freeProductValue = (phaseLevel.freeProductValueCents / 100).toFixed(0);
            result = result.replace(/\{\{freeProductValue\}\}/g, `$${freeProductValue}`);
          }

          // Wallet credit (e.g., "$3" or "$9")
          if (phaseLevel.creditCents > 0) {
            const creditValue = (phaseLevel.creditCents / 100).toFixed(0);
            result = result.replace(/\{\{walletCredit\}\}/g, `$${creditValue}`);
          }
        }

        return result;
      };

      return {
        key,
        title: phaseDict.title ? replaceDynamicTokens(phaseDict.title) : '',
        helper: phaseDict.helper ? replaceDynamicTokens(phaseDict.helper) : '',
        requirements: (phaseDict.requirements as string[])?.map(req => replaceDynamicTokens(req)) ?? [],
        rewards: (phaseDict.rewards as string[])?.map(reward => replaceDynamicTokens(reward)) ?? [],
        unlocked,
        requirementsLabel,
        rewardsLabel,
      };
    }).filter((phase) => phase.unlocked);
  }, [teamsDict.plan, currentPhase, planPrice, phaseLevels]);

  // Conditional returns after all hooks
  if (!teamsDict || !summaryDict) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#f6f8f6] text-slate-500 dark:bg-[#0b1910] dark:text-slate-300">
        <p>Team dictionary copy missing.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8f6] via-white to-[#f0f4f0] text-slate-900 dark:from-[#0b1910] dark:via-[#0f1f15] dark:to-[#0a1810] dark:text-slate-100" data-lang={lang}>
      <main className="px-4 py-12 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-6xl space-y-12">
          <header className="text-center space-y-3 mb-8">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-white dark:to-slate-300">{teamsDict.title}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">{teamsDict.subtitle}</p>
          </header>

          {/* Network Statistics Summary */}
          {!loading && networkStats.totalMembers > 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-lg dark:border-white/10 dark:from-white/5 dark:to-slate-900/20">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-50" />
              <div className="relative">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  {teamsDict.networkSummary?.title ?? 'Resumen de tu Red'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-2xl bg-slate-100/70 dark:bg-white/5">
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{networkStats.totalMembers}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {teamsDict.networkSummary?.totalMembers ?? 'Total Miembros'}
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-emerald-100/70 dark:bg-emerald-500/10">
                    <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{networkStats.activeMembers}</div>
                    <div className="text-sm text-emerald-600 dark:text-emerald-200 mt-1">
                      {teamsDict.networkSummary?.activeMembers ?? 'Activos'}
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-slate-100/70 dark:bg-white/5">
                    <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">{networkStats.inactiveMembers}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {teamsDict.networkSummary?.inactiveMembers ?? 'Inactivos'}
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-blue-100/70 dark:bg-blue-500/10">
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{levelsWithMembers.length}</div>
                    <div className="text-sm text-blue-600 dark:text-blue-200 mt-1">
                      {teamsDict.networkSummary?.levelsActive ?? 'Niveles Activos'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subscription status alert */}
          {!loading && !hasActiveSubscription && levelsWithMembers.length > 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 shadow-lg dark:border-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/5">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-50" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">
                      {teamsDict.subscriptionAlert?.title ?? 'Suscripción Inactiva'}
                    </h3>
                  </div>
                  <p className="text-base text-amber-800 dark:text-amber-200 leading-relaxed">
                    {teamsDict.subscriptionAlert?.description ??
                      'Tu suscripción está inactiva. Puedes ver tu equipo, pero necesitas reactivar tu suscripción para recibir comisiones y beneficios por las ventas de tu red.'}
                  </p>
                </div>
                <Link
                  href={`/${lang}/subscription`}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-base font-bold text-white shadow-lg transition-all duration-200 hover:from-emerald-700 hover:to-emerald-800 hover:shadow-xl hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 whitespace-nowrap"
                >
                  {teamsDict.subscriptionAlert?.action ?? 'Reactivar Suscripción'}
                </Link>
              </div>
            </div>
          )}

          {/* Show only levels with members */}
          {!loading && levelsWithMembers.length > 0 && (
            <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {(() => {
                console.log('[Teams Debug] Rendering levels:', {
                  levelsWithMembers,
                  membersByLevel,
                  levelTargets,
                  hasActiveSubscription,
                });
                return null;
              })()}
              {levelsWithMembers.map((level) => {
                const members = membersByLevel[level] ?? [];
                const target = levelTargets[level] ?? 0;

                // Try to get level title from dictionary, fallback to generic
                const levelKey = `level${level}` as keyof typeof teamsDict;
                const title = typeof teamsDict[levelKey] === 'string'
                  ? teamsDict[levelKey] as string
                  : `Level ${level}`;

                console.log(`[Teams Debug] Rendering level ${level}:`, {
                  title,
                  membersCount: members.length,
                  target,
                  members,
                });

                return (
                  <TeamColumn
                    key={level}
                    title={title}
                    members={members}
                    badgeDict={statusBadgeDict}
                    statusClass={statusClass}
                    target={target}
                    emptyMessage={teamsDict.empty}
                    activeSummary={activeLabel(members)}
                    formatPhaseLabel={formatPhaseLabel}
                    messagingCopy={messagingCopy}
                    hasActiveSubscription={hasActiveSubscription}
                  />
                );
              })}
            </section>
          )}

          {/* Empty state when no team members */}
          {!loading && levelsWithMembers.length === 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 p-12 text-center shadow-lg dark:border-white/10 dark:from-white/5 dark:to-slate-900/20">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-50" />
              <div className="relative">
                <svg className="mx-auto h-16 w-16 text-slate-400 dark:text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {teamsDict.emptyState?.title ?? '¡Comienza a Construir tu Red!'}
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                  {teamsDict.emptyState?.description ??
                    'Aún no tienes miembros en tu equipo. Comparte tu enlace de referido para invitar personas y comenzar a ganar comisiones.'}
                </p>
              </div>
            </div>
          )}

          {planPhases.length > 0 && (
            <section className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-lg dark:border-white/10 dark:from-white/5 dark:to-slate-900/20">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 hover:opacity-100" />
              <div className="relative">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{teamsDict.plan?.title}</h2>
                <p className="text-base text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">{teamsDict.plan?.description}</p>
                <div className="space-y-6">
                  {planPhases.map((phase) => (
                    <PhaseCard key={phase.key} phase={phase} />
                  ))}
                </div>
              </div>
            </section>
          )}




          {loading && (
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 p-8 text-base text-slate-500 shadow-lg dark:border-white/10 dark:from-white/5 dark:to-slate-900/20 dark:text-slate-300">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-gray-500/5 opacity-50" />
              <div className="relative flex items-center justify-center">
                <div className="animate-pulse">{summaryDict.loading}</div>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="relative overflow-hidden rounded-3xl border border-rose-200/60 bg-gradient-to-br from-rose-50 to-pink-50/50 p-8 text-base text-rose-700 shadow-lg dark:border-rose-500/20 dark:from-rose-500/10 dark:to-pink-500/5 dark:text-rose-200">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-pink-500/10 opacity-50" />
              <div className="relative">{summaryDict.error}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TeamColumn({
  title,
  members,
  badgeDict,
  statusClass,
  target,
  emptyMessage,
  activeSummary,
  formatPhaseLabel,
  messagingCopy,
  hasActiveSubscription,
}: {
  title: string;
  members: TreeMember[];
  badgeDict: Record<StatusKey, string>;
  statusClass: (status: string | null) => string;
  target: number;
  emptyMessage: string;
  activeSummary: string;
  formatPhaseLabel: (phase: number | null) => string | null;
  messagingCopy: TeamMessageComposerCopy;
  hasActiveSubscription: boolean;
}) {
  const borderColor = hasActiveSubscription
    ? 'border-slate-200/60 dark:border-white/10'
    : 'border-amber-200/60 dark:border-amber-500/20';

  const gradientOverlay = hasActiveSubscription
    ? 'from-emerald-500/5 to-blue-500/5'
    : 'from-amber-500/5 to-orange-500/5';

  return (
    <div className={`group relative overflow-hidden rounded-3xl border ${borderColor} bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-lg transition-all duration-300 hover:shadow-xl dark:from-white/5 dark:to-slate-900/20`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientOverlay} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            {!hasActiveSubscription && (
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
          </div>
          <div className="text-right">
            <span className="text-lg font-semibold text-slate-900 dark:text-white">{members.length}/{target}</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">{activeSummary}</p>
          </div>
        </div>
        <ul className="space-y-4">
          {members.length === 0 && (
            <li className="rounded-2xl bg-slate-100/70 px-5 py-4 text-sm text-slate-600 backdrop-blur-sm dark:bg-white/5 dark:text-slate-300">
              {emptyMessage}
            </li>
          )}
          {members.map((member) => {
            const status = (member.status ?? 'unpaid') as StatusKey;
            const label = badgeDict?.[status] ?? status;
            const phaseLabel = formatPhaseLabel(member.phase);
            return (
              <li
                key={member.id}
                className="group/item rounded-2xl border border-slate-200/40 bg-white/80 px-5 py-4 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-300/60 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col space-y-1">
                    <span className="font-semibold text-slate-900 dark:text-white">{member.email}</span>
                    {member.name && (
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {member.name}
                      </span>
                    )}
                    {phaseLabel && (
                      <span className="text-xs text-slate-500 dark:text-slate-300">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {phaseLabel}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusClass(member.status)}`}
                    >
                      {label}
                    </span>
                    {(member.allowTeamMessages ?? true) && (
                      <TeamMessageComposer
                        recipient={{ id: member.id, email: member.email }}
                        copy={messagingCopy}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function _LockedState({
  lang,
  title,
  description,
  actionLabel,
}: {
  lang: Locale;
  title?: string;
  description?: string;
  actionLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/50 p-8 text-slate-800 shadow-lg dark:border-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/5 dark:text-amber-100">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-50" />
      <div className="relative">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-3 text-base opacity-90 leading-relaxed">{description}</p>
        <Link
          href={`/${lang}/subscription`}
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-base font-bold text-white shadow-lg transition-all duration-200 hover:from-emerald-700 hover:to-emerald-800 hover:shadow-xl hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function PhaseCard({
  phase,
}: {
  phase: {
    title: string;
    helper: string;
    requirements: string[];
    rewards: string[];
    unlocked: boolean;
    requirementsLabel: string;
    rewardsLabel: string;
  };
}) {
  const indicatorClass = phase.unlocked
    ? 'bg-emerald-500 text-white shadow-lg'
    : 'bg-slate-200 text-slate-600 dark:bg-slate-600/40 dark:text-slate-200';

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/30 p-6 shadow-md transition-all duration-300 hover:shadow-lg dark:border-white/10 dark:from-white/5 dark:to-slate-900/10">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">
        <header className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{phase.title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{phase.helper}</p>
          </div>
          <span className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full px-3 text-sm font-bold transition-all duration-200 ${indicatorClass} ${phase.unlocked ? 'scale-110' : ''}`}>
            {phase.unlocked ? '✓' : '—'}
          </span>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300 mb-3">
              {phase.requirementsLabel}
            </p>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              {phase.requirements.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300 mb-3">
              {phase.rewardsLabel}
            </p>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              {phase.rewards.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500 shadow-sm" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}
