import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionSummary } from '../domain/types';
import { PhaseRepository } from '../repositories/phase-repository';
import { SubscriptionRepository } from '../repositories/subscription-repository';
import { WalletRepository } from '../repositories/wallet-repository';
import { NetworkOverviewService } from './network-overview-service';

export class DashboardSummaryService {
  private readonly phases: PhaseRepository;
  private readonly subscriptions: SubscriptionRepository;
  private readonly wallets: WalletRepository;
  private readonly networkOverview: NetworkOverviewService;

  constructor(private readonly client: SupabaseClient) {
    this.phases = new PhaseRepository(client);
    this.subscriptions = new SubscriptionRepository(client);
    this.wallets = new WalletRepository(client);
    this.networkOverview = new NetworkOverviewService(client);
  }

  async getSummary(userId: string): Promise<SubscriptionSummary> {
    // OPTIMIZED: Fetch phase with commission rate in a single query using JOIN
    // This eliminates the sequential phase_levels lookup that was causing N+1 pattern
    const phaseWithCommissionPromise = Promise.resolve(
      this.client
        .from('phases')
        .select(`
          *,
          phase_levels!left(commission_rate)
        `)
        .eq('user_id', userId)
        .eq('phase_levels.is_active', true)
        .maybeSingle()
    )
      .then(({ data, error }) => {
        if (error) throw error;

        // If we got phase_levels data, merge the commission_rate
        if (data && Array.isArray(data.phase_levels) && data.phase_levels.length > 0) {
          const { phase_levels, ...phaseData } = data;
          return {
            ...phaseData,
            ecommerce_commission: phase_levels[0].commission_rate ?? phaseData.ecommerce_commission,
          };
        }

        return data;
      })
      .catch((_err) => {
        // Fallback to basic phase query if JOIN fails (e.g., table doesn't exist)
        // console.warn('[DashboardSummaryService] phase with commission_rate JOIN failed, falling back:', err);
        return this.phases.findByUserId(userId);
      });

    // Execute ALL queries in parallel, including the optimized phase query
    const [phaseRes, subscriptionRes, walletRes, networkRes] = await Promise.allSettled([
      phaseWithCommissionPromise,
      this.subscriptions.findByUserId(userId),
      this.wallets.findByUserId(userId),
      this.networkOverview.getOverview(userId),
    ]);

    if (phaseRes.status === 'rejected') {
      console.error('[DashboardSummaryService] phases.findByUserId failed:', phaseRes.reason);
    }
    if (subscriptionRes.status === 'rejected') {
      console.error('[DashboardSummaryService] subscriptions.findByUserId failed:', subscriptionRes.reason);
    }
    if (walletRes.status === 'rejected') {
      console.error('[DashboardSummaryService] wallets.findByUserId failed:', walletRes.reason);
    }
    if (networkRes.status === 'rejected') {
      console.error('[DashboardSummaryService] networkOverview.getOverview failed:', networkRes.reason);
    }

    const phase = phaseRes.status === 'fulfilled' ? phaseRes.value : null;
    const subscription = subscriptionRes.status === 'fulfilled' ? subscriptionRes.value : null;
    const wallet = walletRes.status === 'fulfilled' ? walletRes.value : null;
    const network = networkRes.status === 'fulfilled'
      ? networkRes.value
      : { totalMembers: 0, activeMembers: 0, inactiveMembers: 0, levels: [], members: [] };

    const level1Snapshot = network.levels.find((snapshot) => snapshot.level === 1);
    const level2Snapshot = network.levels.find((snapshot) => snapshot.level === 2);
    const level1Count = level1Snapshot?.active ?? 0;
    const level2Count = level2Snapshot?.active ?? 0;

    return {
      phase,
      subscription,
      wallet,
      level1Count,
      level2Count,
      network,
    };
  }
}
