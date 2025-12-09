import { NextResponse } from 'next/server';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { getPhaseLevels } from '@/modules/phase-levels/services/phase-level-service';

/**
 * GET /api/public/mlm-config
 * Public endpoint to get MLM configuration for income calculator
 * Returns phase levels with commission rates and level earnings
 */
export async function GET() {
  try {
    const [settings, phaseLevels] = await Promise.all([
      getAppSettings(),
      getPhaseLevels(),
    ]);

    // Get visible levels configuration from app settings
    const visibleLevels = settings.teamLevelsVisible || 2;

    // Filter phase levels to show only those within the visible range
    // getPhaseLevels() already filters by is_active = true and orders by display_order
    const levels = phaseLevels
      .filter((level) => level.level <= visibleLevels)
      .map((level) => ({
        level: level.level,
        name: level.name,
        nameEn: level.nameEn,
        nameEs: level.nameEs,
        commissionRate: level.commissionRate,
        creditCents: level.creditCents,
        freeProductValueCents: level.freeProductValueCents,
      }));

    return NextResponse.json({
      levels,
      visibleLevels,
      currency: settings.currency,
      rewardCreditLabelEn: settings.rewardCreditLabelEn,
      rewardCreditLabelEs: settings.rewardCreditLabelEs,
      freeProductLabelEn: settings.freeProductLabelEn,
      freeProductLabelEs: settings.freeProductLabelEs,
      affiliateCommissionRate: settings.affiliateCommissionRate,
      affiliateDirectSponsorCommissionRate: settings.affiliateDirectSponsorCommissionRate,
      affiliateGeneralSponsorCommissionRate: settings.affiliateGeneralSponsorCommissionRate,
    });
  } catch (error) {
    console.error('[PublicMLMConfig] Failed to load MLM configuration', error);
    return NextResponse.json(
      { error: 'Unable to load MLM configuration.' },
      { status: 500 },
    );
  }
}

