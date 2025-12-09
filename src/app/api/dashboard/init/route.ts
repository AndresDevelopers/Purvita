import { NextResponse } from 'next/server';
import { createDashboardSummaryService } from '@/modules/multilevel/factories/dashboard-summary-service-factory';
import { createProfileSummaryService } from '@/modules/profile/factories/profile-summary-service-factory';
import { getPlans } from '@/lib/services/plan-service';
import { EnvironmentConfigurationError } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { DashboardSummaryService } from '@/modules/multilevel/services/dashboard-summary-service';
import { ProfileSummaryService } from '@/modules/profile/services/profile-summary-service';
import { withAuth } from '@/lib/auth/with-auth';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';

/**
 * GET /api/dashboard/init
 * SECURED: Uses Supabase session authentication
 *
 * Consolidated endpoint that returns ALL dashboard initialization data in a single response.
 * This eliminates the N+1 API call pattern by fetching:
 * - User profile
 * - Available plans
 * - Dashboard summary (phase, subscription, wallet, network)
 *
 * All data is fetched in parallel for optimal performance.
 */
export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;

  try {
    // Execute ALL queries in parallel to minimize latency
    // This is the key optimization that eliminates N+1 pattern
    const [profileResult, plansResult, summaryResult, settingsResult] = await Promise.allSettled([
      // Fetch user profile
      (async () => {
        try {
          const profileService = createProfileSummaryService();
          const profileSummary = await profileService.getSummary(userId);
          return profileSummary.profile;
        } catch (error) {
          if (error instanceof EnvironmentConfigurationError) {
            const supabase = await createClient();
            const service = new ProfileSummaryService(supabase);
            const profileSummary = await service.getSummary(userId);
            return profileSummary.profile;
          }
          throw error;
        }
      })(),

      // Fetch available plans
      getPlans().catch(err => {
        console.error('[Dashboard Init] Failed to fetch plans:', err);
        return [];
      }),

      // Fetch dashboard summary
      (async () => {
        try {
          const summaryService = createDashboardSummaryService();
          return await summaryService.getSummary(userId);
        } catch (error) {
          if (error instanceof EnvironmentConfigurationError) {
            const supabase = await createClient();
            const service = new DashboardSummaryService(supabase);
            return await service.getSummary(userId);
          }
          throw error;
        }
      })(),

      // Fetch app settings (for affiliate profit value)
      getAppSettings().catch(err => {
        console.error('[Dashboard Init] Failed to fetch app settings:', err);
        return null;
      }),
    ]);

    // Extract results from Promise.allSettled
    const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
    const plans = plansResult.status === 'fulfilled' ? plansResult.value : [];
    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const appSettings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;

    // Log any failures for debugging
    if (profileResult.status === 'rejected') {
      console.error('[Dashboard Init] Profile fetch failed:', profileResult.reason);
    }
    if (plansResult.status === 'rejected') {
      console.error('[Dashboard Init] Plans fetch failed:', plansResult.reason);
    }
    if (summaryResult.status === 'rejected') {
      console.error('[Dashboard Init] Summary fetch failed:', summaryResult.reason);
    }
    if (settingsResult.status === 'rejected') {
      console.error('[Dashboard Init] Phase levels fetch failed:', settingsResult.reason);
    }

    // Calculate plan price (lowest price plan)
    let planPrice: number | null = null;
    if (plans.length > 0) {
      const lowestPricePlan = plans.reduce((min, plan) => 
        plan.price < min.price ? plan : min, 
        plans[0]
      );
      planPrice = lowestPricePlan.price;
    }

    // Get affiliate profit value from app_settings (configured by admin in Affiliates page)
    // storeOwnerDiscountValue is the "Profit Value" configured in Admin → Affiliates
    // storeOwnerDiscountType determines if it's 'fixed' (cents) or 'percent' (0-1)
    let affiliateCommissionRate = 0;
    let affiliateCommissionType: 'fixed' | 'percent' = 'percent';
    
    if (appSettings) {
      affiliateCommissionType = appSettings.storeOwnerDiscountType || 'percent';
      const rawValue = appSettings.storeOwnerDiscountValue;
      
      if (rawValue != null && !Number.isNaN(rawValue)) {
        if (affiliateCommissionType === 'percent') {
          // Already in 0-1 format
          affiliateCommissionRate = rawValue;
        } else {
          // Fixed amount in cents - we'll pass it as is and handle display in frontend
          affiliateCommissionRate = rawValue;
        }
      }
    }

    // Return consolidated response
    return NextResponse.json({
      profile,
      plans,
      summary,
      planPrice,
      // Affiliate profit value from app_settings (configured by admin in Affiliates page)
      affiliateCommissionRate,
      affiliateCommissionType,
    });

  } catch (error) {
    console.error('[Dashboard Init] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

