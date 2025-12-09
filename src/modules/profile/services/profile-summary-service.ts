import type { SupabaseClient } from '@supabase/supabase-js';
import { PhaseRepository } from '@/modules/multilevel/repositories/phase-repository';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { WalletRepository } from '@/modules/multilevel/repositories/wallet-repository';
import { NetworkEarningsRepository } from '@/modules/multilevel/repositories/network-earnings-repository';
import { PayoutAccountRepository } from '@/modules/multilevel/repositories/payout-account-repository';
import {
  OrderRepository,
  type OrderItemRecord,
  type OrderRecord,
} from '@/modules/multilevel/repositories/order-repository';
import { WarehouseTrackingSupabaseRepository } from '@/modules/orders/warehouse/repositories/warehouse-tracking-repository';
import type { WarehouseTrackingEvent } from '@/modules/orders/warehouse/domain/models/warehouse-tracking';
import {
  type ProfileContactInfo,
  type ProfileSummaryPayload,
  type SponsorInfo,
  type OrderTrackingEvent,
  type OrderTrackingSummary,
} from '../domain/types';
import { ProfileUpdateSchema } from '../domain/schemas';

interface RawProfileRow {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  referral_code?: string | null;
  fulfillment_company?: string | null;
  role?: string | null;
  sponsor_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  sponsor?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

const sanitizeString = (value: any): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeProfile = (input: RawProfileRow | null): ProfileContactInfo | null => {
  if (!input) {
    return null;
  }
  return {
    id: input.id,
    name: sanitizeString(input.name) ?? null,
    email: input.email,
    phone: sanitizeString(input.phone),
    address: sanitizeString(input.address),
    city: sanitizeString(input.city),
    state: sanitizeString(input.state),
    postal_code: sanitizeString(input.postal_code),
    country: sanitizeString(input.country),
    avatar_url: sanitizeString(input.avatar_url),
    referral_code: sanitizeString(input.referral_code),
    fulfillment_company: sanitizeString(input.fulfillment_company),
  };
};

const _mapSponsor = (input: RawProfileRow | null): SponsorInfo | null => {
  if (!input?.sponsor) {
    return null;
  }
  return {
    id: input.sponsor.id,
    name: sanitizeString(input.sponsor.name),
    email: sanitizeString(input.sponsor.email),
  };
};

const mapOrderItems = (items: OrderItemRecord[] | undefined) =>
  (items ?? []).map((item) => ({
    product_id: item.product_id ?? null,
    name: sanitizeString(item.product?.name ?? null),
    qty: item.qty,
    price_cents: item.price_cents,
  }));

const groupTrackingByOrder = (events: WarehouseTrackingEvent[]): Map<string, WarehouseTrackingEvent[]> => {
  return events.reduce<Map<string, WarehouseTrackingEvent[]>>((acc, event) => {
    const orderEvents = acc.get(event.orderId) ?? [];
    orderEvents.push(event);
    acc.set(event.orderId, orderEvents);
    return acc;
  }, new Map());
};

const toOrderTrackingSummary = (
  events: WarehouseTrackingEvent[] | undefined,
): OrderTrackingSummary | null => {
  if (!events || events.length === 0) {
    return null;
  }

  const [latest, ...rest] = events;

  const mapEvent = (event: WarehouseTrackingEvent): OrderTrackingEvent => ({
    id: event.id,
    status: event.status,
    responsible_company: event.responsibleCompany ?? null,
    tracking_code: event.trackingCode ?? null,
    location: event.location ?? null,
    note: event.note ?? null,
    estimated_delivery: event.estimatedDelivery,
    event_time: event.eventTime,
  });

  return {
    latestStatus: latest.status,
    statusLabel: latest.status,
    responsible_company: latest.responsibleCompany ?? null,
    tracking_code: latest.trackingCode ?? null,
    location: latest.location ?? null,
    estimated_delivery: latest.estimatedDelivery,
    updated_at: latest.eventTime,
    events: [mapEvent(latest), ...rest.map(mapEvent)],
  };
};

const mapOrders = (rows: OrderRecord[], trackingEvents: WarehouseTrackingEvent[]) => {
  const grouped = groupTrackingByOrder(trackingEvents);

  return rows.map((row) => {
    const tracking = toOrderTrackingSummary(grouped.get(row.id));
    const normalizedStatus = typeof row.status === 'string' ? row.status.toLowerCase() : '';
    const shouldDefaultToPending =
      normalizedStatus === '' ||
      normalizedStatus === 'paid' ||
      normalizedStatus === 'completed' ||
      normalizedStatus === 'fulfilled';

    const derivedStatus = tracking?.latestStatus ?? (shouldDefaultToPending ? 'pending' : normalizedStatus);

    return {
      id: row.id,
      status: derivedStatus,
      total_cents: row.total_cents,
      created_at: row.created_at,
      items: mapOrderItems(row.items),
      tracking,
      archived: row.archived ?? false,
    };
  });
};

export class ReferralCodeError extends Error {
  constructor(
    public readonly reason: 'invalid' | 'conflict',
    message: string,
  ) {
    super(message);
    this.name = 'ReferralCodeError';
  }
}

export type ReferralAvailabilityReason =
  | 'empty'
  | 'referral_code_pattern'
  | 'referral_code_min_length'
  | 'referral_code_max_length'
  | 'referral_code_conflict'
  | 'ok';

export interface ReferralAvailabilityResult {
  available: boolean;
  normalized: string | null;
  reason: ReferralAvailabilityReason;
}

export class ProfileSummaryService {
  private readonly phases: PhaseRepository;
  private readonly subscriptions: SubscriptionRepository;
  private readonly wallets: WalletRepository;
  private readonly orders: OrderRepository;
  private readonly warehouseTracking: WarehouseTrackingSupabaseRepository;
  private readonly networkEarnings: NetworkEarningsRepository;
  private readonly payoutAccounts: PayoutAccountRepository;

  constructor(private readonly client: SupabaseClient) {
    this.phases = new PhaseRepository(client);
    this.subscriptions = new SubscriptionRepository(client);
    this.wallets = new WalletRepository(client);
    this.orders = new OrderRepository(client);
    this.warehouseTracking = new WarehouseTrackingSupabaseRepository(client);
    this.networkEarnings = new NetworkEarningsRepository(client);
    this.payoutAccounts = new PayoutAccountRepository(client);
  }

  async getSummary(userId: string): Promise<ProfileSummaryPayload> {
    // Try to get profile with sponsor relationship
    // Note: sponsor_id might be referred_by depending on schema version
    const profileQuery = this.client
      .from('profiles')
      .select(
        `id,
         name,
         email,
         phone,
         address,
         city,
         state,
         postal_code,
         country,
         avatar_url,
         referral_code,
         fulfillment_company,
         created_at,
         updated_at`
      )
      .eq('id', userId)
      .maybeSingle();

    // Fetch data with error handling for missing tables
    const [profileResult, phase, subscription, wallet, orderRows, earningsSummary, payoutAccount] = await Promise.all([
      profileQuery,
      this.phases.findByUserId(userId).catch(async (err) => {
        console.error('[ProfileSummaryService] Error fetching phase:', err);
        // Try to create base phase if it doesn't exist
        try {
          await this.phases.ensureBasePhase(userId);
          return await this.phases.findByUserId(userId);
        } catch (createErr) {
          console.error('[ProfileSummaryService] Error creating phase:', createErr);
          return null;
        }
      }),
      this.subscriptions.findByUserId(userId).catch((err) => {
        console.error('[ProfileSummaryService] Error fetching subscription:', err);
        return null;
      }),
      this.wallets.findByUserId(userId).catch(async (err) => {
        console.error('[ProfileSummaryService] Error fetching wallet:', err);
        // Try to create wallet if it doesn't exist
        try {
          await this.wallets.ensureWalletExists(userId);
          return await this.wallets.findByUserId(userId);
        } catch (createErr) {
          console.error('[ProfileSummaryService] Error creating wallet:', createErr);
          return null;
        }
      }),
      this.orders.listByUser(userId, 20).catch((err) => {
        console.error('[ProfileSummaryService] Error fetching orders:', err);
        return [];
      }),
      this.networkEarnings
        .fetchAvailableSummary(userId)
        .catch((err) => {
          console.error('[ProfileSummaryService] Error fetching network earnings:', err);
          return { totalAvailableCents: 0, currency: 'USD', members: [] };
        }),
      this.payoutAccounts
        .findByUserId(userId)
        .catch((err) => {
          console.error('[ProfileSummaryService] Error fetching payout account:', err);
          return null;
        }),
    ]);

    const { data: profileData, error: profileError } = profileResult;
    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    const profile = normalizeProfile((profileData as RawProfileRow | null) ?? null);

    const orderIds = orderRows.map((order) => order.id);
    const trackingEvents = await this.warehouseTracking
      .listByOrderIds(orderIds)
      .catch((trackingError) => {
        console.error('[ProfileSummaryService] Error fetching warehouse tracking:', trackingError);
        return [] as WarehouseTrackingEvent[];
      });

    // Try to get sponsor info if sponsor_id or referred_by exists
    let sponsorInfo: SponsorInfo | null = null;
    const rawProfile = profileData as RawProfileRow | null;
    const sponsorId = (rawProfile as any)?.sponsor_id || (rawProfile as any)?.referred_by;
    
    if (sponsorId) {
      try {
        const { data: sponsorData } = await this.client
          .from('profiles')
          .select('id, name, email')
          .eq('id', sponsorId)
          .maybeSingle();
        
        if (sponsorData) {
          sponsorInfo = {
            id: sponsorData.id,
            name: sanitizeString(sponsorData.name),
            email: sanitizeString(sponsorData.email),
          };
        }
      } catch (error) {
        // Ignore sponsor fetch errors
        console.error('Failed to fetch sponsor info:', error);
      }
    }

    // Get the commission rate from phase_levels configuration
    let phaseWithCommission = phase;
    if (phase) {
      const { data: phaseLevel } = await this.client
        .from('phase_levels')
        .select('commission_rate')
        .eq('level', phase.phase)
        .eq('is_active', true)
        .maybeSingle();

      if (phaseLevel) {
        phaseWithCommission = {
          ...phase,
          ecommerce_commission: phaseLevel.commission_rate,
        };
      }
    }

    return {
      profile,
      membership: {
        phase: phaseWithCommission,
        subscription,
        sponsor: sponsorInfo,
        joinDate: rawProfile?.created_at ?? null,
        referralCode: profile?.referral_code ?? null,
      },
      wallet,
      orders: mapOrders(orderRows, trackingEvents),
      networkEarnings: earningsSummary,
      payoutAccount: payoutAccount
        ? {
            provider: payoutAccount.provider,
            status: payoutAccount.status,
            account_id: payoutAccount.account_id,
            created_at: payoutAccount.created_at,
            updated_at: payoutAccount.updated_at,
          }
        : null,
    };
  }

  async updateProfile(userId: string, payload: any) {
    const parsed = ProfileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const referralIssue = parsed.error.issues.find((issue) => issue.path[0] === 'referral_code');
      if (referralIssue) {
        throw new ReferralCodeError('invalid', referralIssue.message);
      }

      throw new Error('Invalid profile update payload');
    }

    const updates = Object.entries(parsed.data).reduce<Record<string, string | null>>((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    if (Object.prototype.hasOwnProperty.call(updates, 'referral_code')) {
      const referralCode = updates.referral_code;

      if (typeof referralCode === 'string' && referralCode.length > 0) {
        const { data: existing, error: referralError } = await this.client
          .from('profiles')
          .select('id')
          .eq('referral_code', referralCode)
          .neq('id', userId)
          .maybeSingle();

        if (referralError && referralError.code !== 'PGRST116') {
          throw referralError;
        }

        if (existing) {
          throw new ReferralCodeError('conflict', 'referral_code_conflict');
        }
      }

      if (referralCode === null) {
        updates.referral_code = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      const summary = await this.getSummary(userId);
      return summary.profile;
    }

    const { data, error } = await this.client
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(
        `id,
         name,
         email,
         phone,
         address,
         city,
         state,
         postal_code,
         country,
         avatar_url,
         referral_code`
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    return normalizeProfile((data as RawProfileRow | null) ?? null);
  }

  async checkReferralAvailability(
    userId: string,
    input: any,
  ): Promise<ReferralAvailabilityResult> {
    const referralCode = sanitizeString(input);

    if (!userId) {
      throw new Error('A user id is required to verify referral code availability.');
    }

    if (!referralCode) {
      return {
        available: true as const,
        normalized: null,
        reason: 'empty' as const,
      };
    }

    const normalized = referralCode.toLowerCase();

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      return {
        available: false as const,
        normalized,
        reason: 'referral_code_pattern' as const,
      };
    }

    if (normalized.length < 4) {
      return {
        available: false as const,
        normalized,
        reason: 'referral_code_min_length' as const,
      };
    }

    if (normalized.length > 32) {
      return {
        available: false as const,
        normalized,
        reason: 'referral_code_max_length' as const,
      };
    }

    const { data: existing, error } = await this.client
      .from('profiles')
      .select('id')
      .eq('referral_code', normalized)
      .neq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return {
      available: !existing,
      normalized,
      reason: existing ? ('referral_code_conflict' as const) : ('ok' as const),
    };
  }
}
