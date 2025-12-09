'use client';

import { Gift, ShoppingBag, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface PhaseReward {
  reward_id: string;
  phase: number;
  has_free_product: boolean;
  free_product_used: boolean;
  credit_remaining_cents: number;
  credit_total_cents?: number | null;
  expires_at: string | null;
}

interface PhaseRewardConfiguration {
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

interface PhaseRewardsSectionProps {
  rewards: PhaseReward | null;
  currentPhase: number;
  lang: string;
  dict: PhaseRewardsDictionary;
  userId: string | null;
  onRewardsUpdate?: () => void;
  configurations?: PhaseRewardConfiguration[];
}

const formatCurrency = (cents: number, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

const formatDate = (dateString: string | null, locale: string) => {
  if (!dateString) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
};

export function PhaseRewardsSection({ rewards, currentPhase, lang, dict, userId: _userId, onRewardsUpdate: _onRewardsUpdate, configurations }: PhaseRewardsSectionProps) {
  // Use current phase instead of rewards phase
  const userPhase = currentPhase || rewards?.phase || 0;

  const configurationMap = useMemo(() => {
    if (!configurations) {
      return new Map<number, PhaseRewardConfiguration>();
    }
    return configurations.reduce((map, config) => {
      map.set(config.phase, config);
      return map;
    }, new Map<number, PhaseRewardConfiguration>());
  }, [configurations]);

  const currentConfiguration = configurationMap.get(userPhase);
  const freeProductValueCents = currentConfiguration?.freeProductValueCents ?? (userPhase === 1 ? 6500 : 0);
  const storeCreditCap = currentConfiguration?.creditCents ?? rewards?.credit_total_cents ?? rewards?.credit_remaining_cents ?? 0;

  // Determine available rewards based on current phase
  const hasFreeProduct =
    userPhase === 1 && rewards?.has_free_product && !rewards?.free_product_used;
  const hasStoreCredit = userPhase >= 2 && (rewards?.credit_remaining_cents ?? 0) > 0;
  const _hasAnyReward = hasFreeProduct || hasStoreCredit || userPhase >= 1;

  // Calculate credit usage percentage based on current phase
  const creditTotal = Math.max(0, storeCreditCap);
  // If no rewards record exists, assume full credit is available (not used yet)
  const creditRemaining = Math.min(creditTotal, rewards?.credit_remaining_cents ?? creditTotal);
  const creditUsed = Math.max(0, creditTotal - creditRemaining);
  const creditUsagePercent = creditTotal > 0 ? (creditUsed / creditTotal) * 100 : 0;

  // Show empty state only if user has no phase
  if (userPhase < 1) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{dict.title}</CardTitle>
          </div>
          <CardDescription>
            {dict.noRewardsDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {dict.noRewards}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <CardTitle>{dict.title}</CardTitle>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {dict.phase} {userPhase}
          </Badge>
        </div>
        <CardDescription>
          {dict.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Free Product Reward (Phase 1) */}
        {userPhase === 1 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    {dict.freeProduct.title}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                  {dict.freeProduct.description}
                </p>
                <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                  {dict.freeProduct.value}: {formatCurrency(freeProductValueCents, lang)}
                </p>
                {rewards?.free_product_used && (
                  <Badge variant="outline" className="mt-2 border-green-600 text-green-600">
                    {dict.freeProduct.used}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Store Credit Reward (Phase 2 & 3) */}
        {userPhase >= 2 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      {dict.storeCredit.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    {dict.storeCredit.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-blue-600 dark:text-blue-400">
                      {dict.storeCredit.remaining}
                    </span>
                    <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(creditRemaining, lang)}
                    </span>
                  </div>
                  
                  <Progress value={100 - creditUsagePercent} className="h-2" />
                  
                  <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                    <span>
                      {dict.storeCredit.used}: {formatCurrency(creditUsed, lang)}
                    </span>
                  </div>
                </div>

                {rewards?.expires_at && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {dict.storeCredit.expiresOn}: {formatDate(rewards.expires_at, lang)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
