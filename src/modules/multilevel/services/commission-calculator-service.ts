import type { SupabaseClient } from '@supabase/supabase-js';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { getCachedPhaseLevels } from '@/lib/helpers/settings-helper';
import type { SentryLogger as _SentryLogger } from '../../observability/services/sentry-logger';
import { SellerCommissionService } from './seller-commission-service';

interface CommissionEntry {
  userId: string;
  memberId: string;
  level: number;
  amountCents: number;
}

export class CommissionCalculatorService {
  constructor(private readonly client: SupabaseClient) { }

  /**
   * Calculate and create network commissions for a purchase
   * @param buyerId - The user who made the purchase
   * @param totalCents - Total purchase amount in cents
   * @returns Array of created commission entries
   *
   * IMPORTANT: Only sponsors with ACTIVE subscriptions receive commissions.
   * Commissions are created but will only be visible/withdrawable when the sponsor has an active subscription.
   *
   * This method also applies the seller's personal commission (Ecommerce Earnings %)
   * when the sale is made through an affiliate store.
   */
  async calculateAndCreateCommissions(
    buyerId: string,
    totalCents: number,
    options: {
      orderId?: string;
      orderMetadata?: Record<string, unknown> | null;
    } = {},
  ): Promise<CommissionEntry[]> {
    // Get app settings to know commission amounts per level
    const settings = await getAppSettings();
    const phaseLevels = await getCachedPhaseLevels();
    const groupGainByLevel = new Map<number, number>();

    phaseLevels.forEach((levelConfig) => {
      groupGainByLevel.set(levelConfig.level, levelConfig.subscriptionDiscountRate ?? 0);
    });

    const normalizedOrderMetadata = await this.resolveOrderMetadata(options.orderId, options.orderMetadata);
    const affiliateId = normalizedOrderMetadata && typeof normalizedOrderMetadata['affiliateId'] === 'string'
      ? (normalizedOrderMetadata['affiliateId'] as string)
      : null;
    const saleChannel = normalizedOrderMetadata && typeof normalizedOrderMetadata['saleChannel'] === 'string'
      ? (normalizedOrderMetadata['saleChannel'] as string)
      : null;
    const isAffiliateSale = Boolean(affiliateId) && (saleChannel ? saleChannel === 'affiliate_store' : true);

    // Apply seller's personal commission (Ecommerce Earnings %) for affiliate store sales
    if (isAffiliateSale && affiliateId) {
      try {
        const sellerCommissionService = new SellerCommissionService(this.client);
        await sellerCommissionService.calculateAndApplySellerCommission(
          affiliateId,
          totalCents,
          options.orderId
        );
      } catch (sellerError) {
        console.error('[CommissionCalculator] Failed to apply seller commission:', sellerError);
        // Don't fail the whole process if seller commission fails
      }
    }

    // Network commissions based on level earnings have been removed
    // Only retail commissions (Group Gain) are now calculated below
    const commissions: CommissionEntry[] = [];
    const now = new Date().toISOString();

    // NEW: Calculate retail commissions for affiliate's sponsors (when sale is from affiliate store)
    if (isAffiliateSale && affiliateId) {
      console.log(`[CommissionCalculator] Processing retail commissions for affiliate ${affiliateId}`);

      // Get the affiliate's phase to determine their level
      const { data: affiliatePhaseData } = await this.client
        .from('phases')
        .select('phase')
        .eq('user_id', affiliateId)
        .maybeSingle();

      const affiliatePhase = affiliatePhaseData?.phase ?? 0;

      // Get affiliate's upline (their sponsors)
      // Using a fixed depth of 10 levels for upline chain
      const affiliateUpline = await this.getUplineChain(affiliateId, 10);

      if (affiliateUpline.length === 0) {
        console.log(`[CommissionCalculator] No upline found for affiliate ${affiliateId}`);
      } else {
        // Pay retail commission to affiliate's direct sponsor only (level 1)
        const directSponsorId = affiliateUpline[0];

        // Check if sponsor has active subscription
        const sponsorHasActiveSubscription = await this.checkActiveSubscription(directSponsorId);

        if (sponsorHasActiveSubscription) {
          // Get the retail commission rate based on affiliate's phase
          const retailCommissionRate = groupGainByLevel.get(affiliatePhase) ?? 0;

          if (retailCommissionRate > 0) {
            const normalizedTotalCents = Number.isFinite(totalCents) && totalCents > 0 ? totalCents : 0;
            const retailCommissionCents = Math.round(normalizedTotalCents * retailCommissionRate);

            // Insert retail commission
            const { error: retailError } = await this.client
              .from('network_commissions')
              .insert({
                user_id: directSponsorId,
                member_id: affiliateId,
                amount_cents: retailCommissionCents,
                available_cents: retailCommissionCents,
                currency: settings.currency,
                level: 1,
                metadata: {
                  commission_type: 'retail_commission',
                  retail_commission_cents: retailCommissionCents,
                  retail_commission_rate: retailCommissionRate,
                  sale_total_cents: normalizedTotalCents,
                  affiliate_id: affiliateId,
                  affiliate_phase: affiliatePhase,
                  order_id: options.orderId,
                },
                created_at: now,
                updated_at: now,
              })
              .select('id')
              .single();

            if (retailError) {
              console.error('[CommissionCalculator] Failed to create retail commission:', retailError);
            } else {
              commissions.push({
                userId: directSponsorId,
                memberId: affiliateId,
                level: 1,
                amountCents: retailCommissionCents,
              });

              console.log(
                `[CommissionCalculator] Created retail commission: Sponsor ${directSponsorId}, ` +
                `Affiliate ${affiliateId} (Phase ${affiliatePhase}), ` +
                `Rate ${(retailCommissionRate * 100).toFixed(1)}%, ` +
                `Amount ${retailCommissionCents} cents from sale of ${normalizedTotalCents} cents`
              );
            }
          } else {
            console.log(`[CommissionCalculator] No retail commission rate configured for phase ${affiliatePhase}`);
          }
        } else {
          console.log(`[CommissionCalculator] Sponsor ${directSponsorId} does not have active subscription, skipping retail commission`);
        }
      }
    }

    return commissions;
  }

  private async resolveOrderMetadata(
    orderId?: string,
    providedMetadata?: Record<string, unknown> | null,
  ): Promise<Record<string, unknown> | null> {
    if (providedMetadata && typeof providedMetadata === 'object') {
      return providedMetadata;
    }

    if (!orderId) {
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('orders')
        .select('metadata')
        .eq('id', orderId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const metadata = (data as { metadata?: unknown }).metadata;
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        return metadata as Record<string, unknown>;
      }

      return null;
    } catch (error) {
      console.warn('[CommissionCalculator] Failed to resolve order metadata', { orderId, error });
      return null;
    }
  }

  /**
   * Check if a user has an active subscription
   * @param userId - The user ID to check
   * @returns true if the user has an active subscription, false otherwise
   */
  private async checkActiveSubscription(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn(`[CommissionCalculator] Error checking subscription for user ${userId}:`, error);
        return false;
      }

      if (!data) {
        return false;
      }

      // User must have active status
      return data.status === 'active';
    } catch (error) {
      console.warn(`[CommissionCalculator] Exception checking subscription for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get the upline chain for a user (sponsor, sponsor's sponsor, etc.)
   * @param userId - Starting user
   * @param maxLevels - Maximum levels to traverse
   * @returns Array of user IDs in upline order
   */
  private async getUplineChain(userId: string, maxLevels: number): Promise<string[]> {
    const upline: string[] = [];
    let currentUserId: string | null = userId;

    for (let level = 0; level < maxLevels; level++) {
      // Get the sponsor of the current user
      const { data: profileData, error } = await this.client
        .from('profiles')
        .select('referred_by, sponsor_id')
        .eq('id', currentUserId)
        .single();

      if (error || !profileData) {
        console.log(`[CommissionCalculator] No profile found for user ${currentUserId}`);
        break;
      }

      // Try referred_by first, then sponsor_id (for schema compatibility)
      const profile = profileData as { referred_by?: string | null; sponsor_id?: string | null };
      const sponsorId: string | null | undefined = profile.referred_by || profile.sponsor_id;

      if (!sponsorId) {
        console.log(`[CommissionCalculator] No sponsor found for user ${currentUserId}`);
        break;
      }

      upline.push(sponsorId);
      currentUserId = sponsorId;
    }

    return upline;
  }

  /**
   * Recalculate commissions for an existing order
   * Useful when app settings change
   */
  async recalculateOrderCommissions(orderId: string): Promise<void> {
    // Get order details
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .select('user_id, total_cents, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Only recalculate for paid orders
    if (order.status !== 'paid') {
      console.log(`[CommissionCalculator] Order ${orderId} is not paid, skipping`);
      return;
    }

    // Delete existing commissions for this order
    await this.client
      .from('network_commissions')
      .delete()
      .eq('member_id', order.user_id)
      .eq('metadata->>order_id', orderId);

    // Recalculate
    await this.calculateAndCreateCommissions(order.user_id, order.total_cents, {
      orderId,
    });
  }
}
