'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import type { UserProfile, Plan } from '@/lib/models/definitions';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { PaymentGateway, SubscriptionRecord, SubscriptionStatus } from '@/modules/multilevel/domain/types';
import { PhaseRewardsAdminSection } from '@/components/admin/phase-rewards-admin-section';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import type { Role } from '@/lib/models/role';

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

interface EditUserFormProps {
  user: UserProfile;
  lang: Locale;
  subscription?: SubscriptionRecord;
  walletBalanceCents: number;
  networkEarningsCents: number;
  referrer?: UserProfile;
  phase?: PhaseData;
  rewards?: RewardData;
}

type DurationPreset = 'custom' | '1m' | '3m' | '6m' | '12m';

const durationPresetMonths: Record<Exclude<DurationPreset, 'custom'>, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '12m': 12,
};

const formatDateInput = (date: Date) => {
  const adjusted = new Date(date);
  adjusted.setUTCHours(0, 0, 0, 0);
  return adjusted.toISOString().slice(0, 10);
};

const calculateFutureDate = (monthsAhead: number) => {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setMonth(base.getMonth() + monthsAhead);
  return formatDateInput(base);
};

const toIsoDate = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString();
};

const normalizeDateForComparison = (isoString: string | null) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

export default function EditUserForm({
  user,
  lang,
  subscription,
  walletBalanceCents,
  networkEarningsCents,
  referrer,
  phase,
  rewards,
}: EditUserFormProps) {
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Subscription initial values
  const initialSubscriptionStatus: SubscriptionStatus = subscription?.status ?? 'canceled';
  const initialSubscriptionGateway: PaymentGateway = subscription?.gateway ?? 'wallet';
  const initialPeriodEndDate = subscription?.current_period_end
    ? formatDateInput(new Date(subscription.current_period_end))
    : '';
  const initialPeriodEndIso = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toISOString()
    : null;
  // Determine initial subscription type from the plan
  const initialSubscriptionType: 'mlm' | 'affiliate' = (subscription as any)?.subscription_type ?? 'mlm';

  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    role_id: user.role_id || null,
    status: user.status,
    phone: user.phone || '',
    address: user.address || '',
    city: user.city || '',
    country: user.country || '',
    commission_rate: user.commission_rate,
  });

  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  // Single subscription states (MLM and Affiliate are mutually exclusive)
  const [subscriptionType, setSubscriptionType] = useState<'mlm' | 'affiliate'>(initialSubscriptionType);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(initialSubscriptionStatus);
  const [subscriptionGateway, setSubscriptionGateway] = useState<PaymentGateway>(initialSubscriptionGateway);
  const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] = useState(initialPeriodEndDate);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(subscription?.cancel_at_period_end ?? false);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('custom');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(subscription?.plan_id || null);

  // Other states
  const [walletAmount, setWalletAmount] = useState(() => (walletBalanceCents / 100).toFixed(2));
  const [walletNote, setWalletNote] = useState('');
  const [networkEarningsAmount, setNetworkEarningsAmount] = useState(() => (networkEarningsCents / 100).toFixed(2));
  const [networkEarningsNote, setNetworkEarningsNote] = useState('');
  const [referredBy, setReferredBy] = useState(user.referred_by ?? '');
  const [userPhase, setUserPhase] = useState(phase?.phase ?? 0);

  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);

  // Load available plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await adminApi.get('/api/admin/plans');
        if (response.ok) {
          const data = await response.json();
          setAvailablePlans(data);
        }
      } catch (error) {
        console.error('Error loading plans:', error);
      }
    };
    loadPlans();
  }, []);

  const mlmPlans = useMemo(() => availablePlans.filter(p => p.is_mlm_plan), [availablePlans]);
  const affiliatePlans = useMemo(() => availablePlans.filter(p => p.is_affiliate_plan), [availablePlans]);

  // Get the selected plan and determine its type
  const selectedPlan = useMemo(() => availablePlans.find(p => p.id === selectedPlanId), [availablePlans, selectedPlanId]);
  const isPlanSelected = !!selectedPlan;

  // Load available roles
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await adminApi.get('/api/admin/roles');
        if (response.ok) {
          const data = await response.json();
          setAvailableRoles(data);
        }
      } catch (error) {
        console.error('Error loading roles:', error);
      }
    };
    loadRoles();
  }, []);

  /**
   * Automatically sync commission rate when phase changes.
   * Uses centralized phase configuration for consistency via API.
   */
  useEffect(() => {
    const updateCommission = async () => {
      try {
        const response = await fetch(`/api/admin/phase-levels/commission?phase=${userPhase}`);
        if (!response.ok) {
          console.error('[EditUserForm] Failed to fetch commission rate');
          return;
        }
        const data = await response.json();
        setFormData((prev) => ({
          ...prev,
          commission_rate: data.commissionRate,
        }));
      } catch (_error) {
        console.error('[EditUserForm] Error fetching commission rate:', _error);
      }
    };
    void updateCommission();
  }, [userPhase]);

  // Subscription status effect - set default date when activating
  useEffect(() => {
    if (subscriptionStatus === 'active' && !subscriptionPeriodEnd && initialSubscriptionStatus !== 'active') {
      const defaultDate = calculateFutureDate(durationPresetMonths['1m']);
      setDurationPreset('1m');
      setSubscriptionPeriodEnd(defaultDate);
    }
    if (subscriptionStatus !== 'active') {
      setDurationPreset('custom');
    }
     
  }, [subscriptionStatus, initialSubscriptionStatus, subscriptionPeriodEnd]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: Record<string, unknown> = {};

      const profilePayload: Record<string, unknown> = { ...formData };
      const trimmedReferred = referredBy.trim();

      if (trimmedReferred.length > 0) {
        profilePayload.referred_by = trimmedReferred;
      } else if (user.referred_by) {
        profilePayload.referred_by = null;
      }

      if (Object.keys(profilePayload).length > 0) {
        updates.profile = profilePayload;
      }

      // Subscription validation and changes (MLM and Affiliate are mutually exclusive)
      let subscriptionPeriodEndIso: string | null = null;
      if (subscriptionStatus === 'active') {
        if (!subscriptionPeriodEnd) {
          toast({
            title: 'Falta la vigencia',
            description: 'Selecciona hasta cuándo estará activa la suscripción.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        subscriptionPeriodEndIso = toIsoDate(subscriptionPeriodEnd);
      }

      const normalizedNewDate = normalizeDateForComparison(subscriptionPeriodEndIso);
      const normalizedInitialDate = normalizeDateForComparison(initialPeriodEndIso);

      const hasSubscriptionChanges =
        subscriptionStatus !== initialSubscriptionStatus ||
        subscriptionGateway !== initialSubscriptionGateway ||
        cancelAtPeriodEnd !== (subscription?.cancel_at_period_end ?? false) ||
        selectedPlanId !== (subscription?.plan_id ?? null) ||
        subscriptionType !== initialSubscriptionType ||
        (subscriptionStatus === 'active' && normalizedNewDate !== normalizedInitialDate) ||
        (subscriptionStatus !== 'active' && initialSubscriptionStatus === 'active');

      if (hasSubscriptionChanges) {
        updates.subscription = {
          subscriptionType,
          status: subscriptionStatus,
          currentPeriodEnd: subscriptionStatus === 'active' ? subscriptionPeriodEndIso : null,
          gateway: subscriptionGateway,
          planId: selectedPlanId,
          cancelAtPeriodEnd,
        };
      }

      // Wallet validation and update
      const walletAmountTrimmed = walletAmount.trim();
      const normalizedWalletAmount = walletAmountTrimmed.replace(',', '.');
      const parsedWalletAmount = walletAmountTrimmed === '' ? 0 : Number(normalizedWalletAmount);

      if (Number.isNaN(parsedWalletAmount) || parsedWalletAmount < 0) {
        toast({
          title: (dict.admin as any).userUpdateFeedback?.invalidWalletAmountTitle ?? 'Saldo inválido',
          description:
            (dict.admin as any).userUpdateFeedback?.invalidWalletAmountDescription ??
            'Ingresa un monto válido para el balance del monedero.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const targetBalanceCents = Math.round(parsedWalletAmount * 100);
      const walletNoteValue = walletNote.trim();
      const walletChanged =
        targetBalanceCents !== walletBalanceCents || (walletNoteValue.length > 0 && targetBalanceCents === walletBalanceCents);

      if (walletChanged) {
        updates.wallet = {
          targetBalanceCents,
          ...(walletNoteValue ? { note: walletNoteValue } : {}),
        };
      }

      // Network earnings validation and update
      const networkEarningsAmountTrimmed = networkEarningsAmount.trim();
      const normalizedNetworkEarningsAmount = networkEarningsAmountTrimmed.replace(',', '.');
      const parsedNetworkEarningsAmount = networkEarningsAmountTrimmed === '' ? 0 : Number(normalizedNetworkEarningsAmount);

      if (Number.isNaN(parsedNetworkEarningsAmount) || parsedNetworkEarningsAmount < 0) {
        toast({
          title: (dict.admin as any).userUpdateFeedback?.invalidNetworkEarningsTitle ?? 'Ganancias inválidas',
          description:
            (dict.admin as any).userUpdateFeedback?.invalidNetworkEarningsDescription ??
            'Ingresa un monto válido para las ganancias de red.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const targetNetworkEarningsCents = Math.round(parsedNetworkEarningsAmount * 100);
      const networkEarningsNoteValue = networkEarningsNote.trim();
      const networkEarningsChanged =
        targetNetworkEarningsCents !== networkEarningsCents ||
        (networkEarningsNoteValue.length > 0 && targetNetworkEarningsCents === networkEarningsCents);

      if (networkEarningsChanged) {
        updates.networkEarnings = {
          targetAmountCents: targetNetworkEarningsCents,
          ...(networkEarningsNoteValue ? { note: networkEarningsNoteValue } : {}),
        };
      }

      // Phase updates
      if (userPhase !== (phase?.phase ?? 0)) {
        updates.phase = {
          phase: userPhase,
        };
      }

      if (!updates.profile && !updates.subscription && !updates.wallet && !updates.networkEarnings && !updates.phase) {
        toast({
          title: (dict.admin as any).userUpdateFeedback?.noChangesTitle ?? 'Sin cambios detectados',
          description:
            (dict.admin as any).userUpdateFeedback?.noChangesDescription ??
            'Actualiza al menos un campo antes de guardar.',
        });
        setLoading(false);
        return;
      }

      const response = await adminApi.put(`/api/admin/users/${user.id}`, updates);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error updating user' }));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Error updating user`);
      }

      toast({
        title: (dict.admin as any).userUpdateFeedback?.successTitle ?? 'Usuario actualizado',
        description:
          (dict.admin as any).userUpdateFeedback?.successDescription ??
          'Los datos del usuario se guardaron correctamente. El usuario verá los cambios al refrescar su página.',
      });

      router.push(`/admin/users?lang=${lang}`);
      router.refresh();
    } catch (error) {
      toast({
        title: (dict.admin as any).userUpdateFeedback?.errorTitle ?? 'Error al actualizar',
        description:
          error instanceof Error
            ? error.message
            : (dict.admin as any).userUpdateFeedback?.errorDescription ??
            'No se pudo actualizar el usuario. Inténtalo nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const _subscriptionSection = (dict.admin as any).subscriptionSettings ?? {};
  const walletSection = (dict.admin as any).walletSettings ?? {};
  const networkEarningsSection = (dict.admin as any).networkEarningsSettings ?? {};
  const referralSection = (dict.admin as any).referralSettings ?? {};

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{dict.auth.nameLabel}</Label>
          <Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{dict.auth.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">
            {dict.admin.userForm?.role ?? 'Role'}
          </Label>
          <Select
            value={formData.role_id || 'none'}
            onValueChange={(value) => handleInputChange('role_id', value === 'none' ? null : value)}
          >
            <SelectTrigger id="role">
              <SelectValue placeholder={dict.admin.userForm?.selectRole ?? 'Select role'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {dict.admin.userForm?.noRoleAssigned ?? 'No role assigned'}
              </SelectItem>
              {availableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                  {role.is_system_role && ' (System)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {dict.admin.userForm?.roleDescription ?? 'Defines user permissions in the admin panel.'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">{(dict.admin as any).status ?? 'Status'}</Label>
          <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
            <SelectTrigger id="status">
              <SelectValue placeholder={(dict.admin as any).selectStatus ?? 'Select status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{dict.team.statusActive}</SelectItem>
              <SelectItem value="inactive">{dict.team.statusInactive}</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="commission_rate">Tasa de Comisión (%)</Label>
          <Input
            id="commission_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.commission_rate * 100}
            onChange={(e) => handleInputChange('commission_rate', parseFloat(e.target.value) / 100)}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Controlado automáticamente por la fase MLM
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">Ciudad</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            placeholder="Madrid"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">País</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
            placeholder="España"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          placeholder="Calle Principal 123, Piso 2"
          rows={3}
        />
      </div>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Suscripción</h3>
          <p className="text-sm text-muted-foreground">
            El usuario puede tener una suscripción activa: MLM (Red Multinivel) o Afiliado (Tienda). Ambas dan acceso a la tienda personalizada.
          </p>
        </div>

        {/* Subscription Type Selector */}
        <div className="space-y-2">
          <Label>Tipo de Suscripción</Label>
          <Select
            value={subscriptionType}
            onValueChange={(val) => {
              setSubscriptionType(val as 'mlm' | 'affiliate');
              // Clear plan when changing type
              setSelectedPlanId(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mlm">🌐 Red Multinivel (MLM)</SelectItem>
              <SelectItem value="affiliate">🛒 Afiliado (Tienda)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {subscriptionType === 'mlm' 
              ? 'Acceso a la red multinivel con comisiones por niveles y tienda personalizada.'
              : 'Acceso a tienda personalizada con comisiones de afiliado.'}
          </p>
        </div>

        {/* Plan Selector based on type */}
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select
            value={selectedPlanId ?? 'none'}
            onValueChange={(val) => {
              if (val !== 'none') {
                setSelectedPlanId(val);
                if (subscriptionStatus !== 'active') {
                  setSubscriptionStatus('active');
                }
              } else {
                // When selecting "Ninguno", cancel the subscription
                setSelectedPlanId(null);
                setSubscriptionStatus('canceled');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno (Cancelar suscripción)</SelectItem>
              {(subscriptionType === 'mlm' ? mlmPlans : affiliatePlans).map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPlanId === null && subscriptionStatus === 'canceled' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Al guardar, la suscripción será cancelada.
            </p>
          )}
        </div>

        {/* Subscription details - only show if a plan is selected */}
        <div className={isPlanSelected ? 'block' : 'hidden opacity-50 pointer-events-none'}>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="subscription-status">Estado de la suscripción</Label>
                <Switch
                  id="subscription-status"
                  checked={subscriptionStatus === 'active'}
                  onCheckedChange={(checked) => setSubscriptionStatus(checked ? 'active' : 'canceled')}
                />
              </div>
              <Select value={subscriptionStatus} onValueChange={(value) => setSubscriptionStatus(value as SubscriptionStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="past_due">Atrasada</SelectItem>
                  <SelectItem value="canceled">Cancelada</SelectItem>
                  <SelectItem value="unpaid">No pagada</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define el estado actual de la membresía del usuario.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-gateway">Proveedor de cobro</Label>
              <Select
                value={subscriptionGateway}
                onValueChange={(value) => setSubscriptionGateway(value as PaymentGateway)}
                disabled={subscriptionStatus !== 'active'}
              >
                <SelectTrigger id="subscription-gateway">
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet">Monedero interno</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Elige la pasarela que respalda la suscripción.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="space-y-2">
              <Label htmlFor="subscription-duration">Duración</Label>
              <Select
                value={durationPreset}
                onValueChange={(value) => {
                  const preset = value as DurationPreset;
                  setDurationPreset(preset);
                  if (preset !== 'custom') {
                    const months = durationPresetMonths[preset];
                    const futureDate = calculateFutureDate(months);
                    setSubscriptionPeriodEnd(futureDate);
                  }
                }}
                disabled={subscriptionStatus !== 'active'}
              >
                <SelectTrigger id="subscription-duration">
                  <SelectValue placeholder="Selecciona una vigencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 mes</SelectItem>
                  <SelectItem value="3m">3 meses</SelectItem>
                  <SelectItem value="6m">6 meses</SelectItem>
                  <SelectItem value="12m">12 meses</SelectItem>
                  <SelectItem value="custom">Fecha personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-period-end">Vigente hasta</Label>
              <Input
                id="subscription-period-end"
                type="date"
                value={subscriptionPeriodEnd}
                onChange={(event) => {
                  setDurationPreset('custom');
                  setSubscriptionPeriodEnd(event.target.value);
                }}
                disabled={subscriptionStatus !== 'active'}
              />
              <p className="text-xs text-muted-foreground">
                La suscripción expirará al finalizar esta fecha.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cancel-at-period-end"
                checked={cancelAtPeriodEnd}
                onCheckedChange={(checked) => setCancelAtPeriodEnd(checked as boolean)}
                disabled={subscriptionStatus !== 'active'}
              />
              <Label htmlFor="cancel-at-period-end" className="text-sm font-normal">
                Cancelar al final del período
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Si está marcado, la suscripción se cancelará automáticamente cuando expire.
            </p>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{(walletSection as any).title ?? 'Monedero'}</h3>
          <p className="text-sm text-muted-foreground">
            {(walletSection as any).description ?? 'Ajusta el saldo disponible para reflejar pagos externos o correcciones.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{(walletSection as any).currentBalanceLabel ?? 'Saldo actual'}</Label>
            <Input value={(walletBalanceCents / 100).toFixed(2)} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-amount">{(walletSection as any).targetBalanceLabel ?? 'Nuevo saldo'}</Label>
            <Input
              id="wallet-amount"
              type="number"
              min="0"
              step="0.01"
              value={walletAmount}
              onChange={(event) => setWalletAmount(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet-note">{(walletSection as any).noteLabel ?? 'Nota interna (opcional)'}</Label>
          <Textarea
            id="wallet-note"
            rows={3}
            value={walletNote}
            onChange={(event) => setWalletNote(event.target.value)}
            placeholder={(walletSection as any).notePlaceholder ?? 'Ej. Ajuste manual por pago en efectivo'}
          />
          <p className="text-xs text-muted-foreground">
            {(walletSection as any).helper ?? 'La nota quedará registrada en el historial de transacciones.'}
          </p>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{(networkEarningsSection as any).title ?? 'Ganancias de Red'}</h3>
          <p className="text-sm text-muted-foreground">
            {(networkEarningsSection as any).description ?? 'Ajusta las ganancias disponibles generadas por la red multinivel del usuario.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{(networkEarningsSection as any).currentBalanceLabel ?? 'Ganancias actuales'}</Label>
            <Input value={(networkEarningsCents / 100).toFixed(2)} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="network-earnings-amount">{(networkEarningsSection as any).targetBalanceLabel ?? 'Nuevas ganancias'}</Label>
            <Input
              id="network-earnings-amount"
              type="number"
              min="0"
              step="0.01"
              value={networkEarningsAmount}
              onChange={(event) => setNetworkEarningsAmount(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="network-earnings-note">{(networkEarningsSection as any).noteLabel ?? 'Nota interna (opcional)'}</Label>
          <Textarea
            id="network-earnings-note"
            rows={3}
            value={networkEarningsNote}
            onChange={(event) => setNetworkEarningsNote(event.target.value)}
            placeholder={(networkEarningsSection as any).notePlaceholder ?? 'Ej. Ajuste por comisiones no registradas'}
          />
          <p className="text-xs text-muted-foreground">
            {(networkEarningsSection as any).helper ?? 'Las ganancias ajustadas estarán disponibles para transferir al monedero.'}
          </p>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{(referralSection as any).title ?? 'Asignación de equipo'}</h3>
          <p className="text-sm text-muted-foreground">
            {(referralSection as any).description ?? 'Asigna este usuario al equipo de otro usuario ingresando el ID del líder del equipo.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-id">{(referralSection as any).teamIdLabel ?? 'ID del equipo (líder)'}</Label>
          <Input
            id="team-id"
            value={referredBy}
            onChange={(event) => setReferredBy(event.target.value)}
            placeholder={(referralSection as any).teamIdPlaceholder ?? 'Pega el ID del usuario líder del equipo'}
          />
          <p className="text-xs text-muted-foreground">
            {(referralSection as any).teamIdHelper ?? 'Introduce el ID del usuario cuyo equipo se unirá este miembro, o deja vacío para que no pertenezca a ningún equipo.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {(referralSection as any).currentReferrer ?? 'Equipo asignado actualmente'}
            </p>
            {referrer ? (
              <>
                <p className="mt-2 text-base font-semibold text-amber-900 dark:text-amber-100">
                  {referrer.name}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {referrer.email}
                </p>
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {(referralSection as any).teamSize ?? 'Tamaño del equipo'}: {referrer.team_count ?? 0} {(referralSection as any).members ?? 'miembros'}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReferredBy('')}
                  className="mt-3 text-amber-900 hover:text-amber-950 dark:text-amber-100 dark:hover:text-amber-50"
                >
                  {(referralSection as any).clear ?? 'Remover de este equipo'}
                </Button>
              </>
            ) : (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {(referralSection as any).none ?? 'No asignado a ningún equipo'}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {(referralSection as any).currentUserTeam ?? 'Equipo de este usuario'}
            </p>
            <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-100">
              {user.team_count ?? 0} {(referralSection as any).members ?? 'miembros'}
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              {(referralSection as any).teamCountHelper ?? 'Usuarios que tienen a este usuario como líder de equipo'}
            </p>
          </div>
        </div>
      </section>

      <PhaseRewardsAdminSection
        phase={phase}
        rewards={rewards}
        userPhase={userPhase}
        setUserPhase={setUserPhase}
        userId={user.id}
        dict={(dict.admin as any).phaseRewardsSettings ?? {}}
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => router.back()} disabled={loading}>
          {dict.admin.cancel}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (dict.admin.saving ?? 'Guardando...') : dict.admin.saveChanges}
        </Button>
      </div>
    </form>
  );
}
