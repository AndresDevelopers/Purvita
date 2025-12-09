import type { SupabaseClient } from '@supabase/supabase-js';
import { getPhaseCommissionRate } from '@/lib/helpers/settings-helper';
import { WalletService } from './wallet-service';

/**
 * Service for calculating and applying seller's personal ecommerce commission
 * 
 * This service handles the "Ecommerce Earnings (%)" field from app-settings.
 * When a user sells products through their affiliate store, they receive a percentage
 * of the sale as their personal commission.
 */
export class SellerCommissionService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Calculate and apply seller's personal commission for an affiliate store sale
   * 
   * @param affiliateId - The ID of the affiliate store owner (seller)
   * @param totalCents - Total sale amount in cents
   * @param orderId - Optional order ID for tracking
   * @returns Commission amount in cents that was applied
   */
  async calculateAndApplySellerCommission(
    affiliateId: string,
    totalCents: number,
    orderId?: string
  ): Promise<number> {
    if (!affiliateId || totalCents <= 0) {
      console.log('[SellerCommission] Invalid parameters, skipping commission');
      return 0;
    }

    try {
      // Get seller's current phase
      const { data: phaseData, error: phaseError } = await this.client
        .from('phases')
        .select('phase')
        .eq('user_id', affiliateId)
        .maybeSingle();

      if (phaseError) {
        console.error('[SellerCommission] Error fetching seller phase:', phaseError);
        return 0;
      }

      const sellerPhase = phaseData?.phase ?? 0;

      // Get commission rate for seller's phase
      const commissionRate = await getPhaseCommissionRate(sellerPhase);

      if (commissionRate <= 0) {
        console.log(`[SellerCommission] No commission rate for phase ${sellerPhase}`);
        return 0;
      }

      // Calculate commission
      const commissionCents = Math.round(totalCents * commissionRate);

      if (commissionCents <= 0) {
        console.log('[SellerCommission] Calculated commission is 0 or negative');
        return 0;
      }

      // Check if seller has active subscription
      const hasActiveSubscription = await this.checkActiveSubscription(affiliateId);
      
      if (!hasActiveSubscription) {
        console.log(`[SellerCommission] Seller ${affiliateId} does not have active subscription, skipping commission`);
        return 0;
      }

      // Add commission to seller's wallet
      const walletService = new WalletService(this.client);
      await walletService.addFunds(
        affiliateId,
        commissionCents,
        'sale_commission',
        undefined,
        `Ecommerce commission from affiliate store sale`,
        {
          source: 'affiliate_store_sale',
          commission_rate: commissionRate,
          sale_total_cents: totalCents,
          seller_phase: sellerPhase,
          ...(orderId ? { order_id: orderId } : {}),
        }
      );

      console.log(
        `[SellerCommission] Applied ${commissionCents} cents commission to seller ${affiliateId} (${(commissionRate * 100).toFixed(1)}% of ${totalCents} cents)`
      );

      return commissionCents;
    } catch (error) {
      console.error('[SellerCommission] Error applying seller commission:', error);
      return 0;
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
        .select('status, waitlisted')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn(`[SellerCommission] Error checking subscription for user ${userId}:`, error);
        return false;
      }

      if (!data) {
        return false;
      }

      // User must have active status and not be waitlisted
      return data.status === 'active' && !data.waitlisted;
    } catch (error) {
      console.warn(`[SellerCommission] Exception checking subscription for user ${userId}:`, error);
      return false;
    }
  }
}

