'use client';

import { TrendingUp, AlertCircle, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PhaseRewardConfiguration {
  phase: number;
  creditCents: number;
  freeProductValueCents: number;
  commissionRate: number;
  name: string;
}

interface PhaseData {
  phase: number;
  ecommerce_commission: number;
}

interface RewardData {
  reward_id: string;
  phase: number;
  has_free_product: boolean;
  free_product_used: boolean;
  credit_remaining_cents: number;
  expires_at: string | null;
}

interface CalculatedPhaseData {
  calculatedPhase: number;
  directActiveCount: number;
  totalDirectReferrals: number;
  secondLevelTotal: number;
  minSecondLevel: number;
  subscriptionActive: boolean;
}

interface PhaseRewardsAdminSectionProps {
  phase?: PhaseData;
  rewards?: RewardData;
  userPhase: number;
  setUserPhase: (phase: number) => void;
  userId: string;
  dict: {
    title?: string;
    description?: string;
    phaseLabel?: string;
    phaseHelper?: string;
    rewardAlreadyGranted?: string;
    currentRewards?: string;
    noRewards?: string;
    freeProduct?: string;
    storeCredit?: string;
    remaining?: string;
    used?: string;
    expiresOn?: string;
  };
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

const _formatDate = (dateString: string | null) => {
  if (!dateString) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
};

export function PhaseRewardsAdminSection({
  phase,
  rewards: _rewards,
  userPhase,
  setUserPhase,
  userId,
  dict,
}: PhaseRewardsAdminSectionProps) {
  const [phaseConfigurations, setPhaseConfigurations] = useState<Record<number, PhaseRewardConfiguration>>({});
  const [calculatedPhase, setCalculatedPhase] = useState<CalculatedPhaseData | null>(null);
  const [loadingCalculation, setLoadingCalculation] = useState(true);

  // Load phase configurations
  useEffect(() => {
    const controller = new AbortController();

    const loadPhaseConfigurations = async () => {
      try {
        const response = await fetch('/api/admin/phase-levels', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load phase configuration');
        }

        const data = await response.json();

        const mapping = (data.phaseLevels ?? []).reduce(
          (acc: Record<number, PhaseRewardConfiguration>, item: any) => {
            acc[item.level] = {
              phase: item.level,
              creditCents: item.creditCents ?? 0,
              freeProductValueCents: item.freeProductValueCents ?? 0, // Dynamic from database
              commissionRate: item.commissionRate ?? 0,
              name: item.name ?? `Phase ${item.level}`,
            };
            return acc;
          },
          {},
        );

        setPhaseConfigurations(mapping);
      } catch (_error) {
        if ((_error as Error).name === 'AbortError') {
          return;
        }
        console.error('[PhaseRewardsAdminSection] Failed to load phase configurations', _error);
      }
    };

    void loadPhaseConfigurations();

    return () => {
      controller.abort();
    };
  }, []);

  // Load calculated phase
  useEffect(() => {
    const controller = new AbortController();

    const loadCalculatedPhase = async () => {
      setLoadingCalculation(true);
      try {
        const response = await fetch(`/api/admin/users/${userId}/calculated-phase`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load calculated phase');
        }

        const data = await response.json();
        setCalculatedPhase(data);
      } catch (_error) {
        if ((_error as Error).name === 'AbortError') {
          return;
        }
        console.error('[PhaseRewardsAdminSection] Failed to load calculated phase', _error);
      } finally {
        setLoadingCalculation(false);
      }
    };

    void loadCalculatedPhase();

    return () => {
      controller.abort();
    };
  }, [userId]);

  const selectedPhaseConfig = useMemo(() => phaseConfigurations[userPhase], [phaseConfigurations, userPhase]);
  const calculatedPhaseConfig = useMemo(
    () => (calculatedPhase ? phaseConfigurations[calculatedPhase.calculatedPhase] : undefined),
    [phaseConfigurations, calculatedPhase]
  );

  // All values come dynamically from phase configuration - NO hardcoded values
  const _previewFreeProductValue = selectedPhaseConfig?.freeProductValueCents ?? 0;

  // Calculate credit based on selected phase if granting
  const _displayPhase = userPhase;
  const _creditTotal = selectedPhaseConfig?.creditCents ?? 0;

  // Check if phase was manually overridden
  const isManualOverride = calculatedPhase && userPhase !== calculatedPhase.calculatedPhase;
  const currentPhase = phase?.phase ?? 0;

  return (
    <>
      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{dict.title ?? 'MLM Phase & Rewards'}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {dict.description ?? 'Manage the user\'s MLM phase and grant monthly rewards'}
          </p>
        </div>

        {/* Automatic Phase Indicator */}
        {!loadingCalculation && calculatedPhase && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm">
              <div className="space-y-1">
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  Fase Automática Calculada: Phase {calculatedPhase.calculatedPhase}
                  {calculatedPhaseConfig && ` - ${calculatedPhaseConfig.name}`}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Basado en: {calculatedPhase.totalDirectReferrals} referidos directos
                  {calculatedPhase.directActiveCount !== calculatedPhase.totalDirectReferrals &&
                    ` (${calculatedPhase.directActiveCount} con suscripción activa)`}
                  {calculatedPhase.secondLevelTotal > 0 && `, ${calculatedPhase.secondLevelTotal} en segundo nivel`}
                </p>
                {isManualOverride && (
                  <div className="mt-2 flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">
                      Fase modificada manualmente por admin (actual: Phase {currentPhase})
                    </span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="user-phase">{dict.phaseLabel ?? 'MLM Phase (Manual)'}</Label>
              {isManualOverride && (
                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
                  Manual Override
                </Badge>
              )}
            </div>
            <Select value={userPhase.toString()} onValueChange={(value) => setUserPhase(parseInt(value))}>
              <SelectTrigger id="user-phase">
                <SelectValue placeholder="Select phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">
                  Phase 0 - Registration
                  {calculatedPhase?.calculatedPhase === 0 && ' ✓'}
                </SelectItem>
                <SelectItem value="1">
                  Phase 1 - First Partners
                  {calculatedPhase?.calculatedPhase === 1 && ' ✓'}
                </SelectItem>
                <SelectItem value="2">
                  Phase 2 - Duplicate Team
                  {calculatedPhase?.calculatedPhase === 2 && ' ✓'}
                </SelectItem>
                <SelectItem value="3">
                  Phase 3 - Network Momentum
                  {calculatedPhase?.calculatedPhase === 3 && ' ✓'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedPhaseConfig && (
            <div className="flex flex-col justify-end">
              <div className="space-y-1 rounded-md border border-muted bg-muted/50 p-2">
                <p className="text-xs font-medium text-foreground">Valores de Phase {userPhase}:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Comisión:</span>
                  <span className="font-medium text-foreground">
                    {(selectedPhaseConfig.commissionRate * 100).toFixed(0)}%
                  </span>
                  {selectedPhaseConfig.freeProductValueCents > 0 && (
                    <>
                      <span>Producto Gratis:</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(selectedPhaseConfig.freeProductValueCents)}
                      </span>
                    </>
                  )}
                  {selectedPhaseConfig.creditCents > 0 && (
                    <>
                      <span>Crédito Mensual:</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(selectedPhaseConfig.creditCents)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </section>
    </>
  );
}
