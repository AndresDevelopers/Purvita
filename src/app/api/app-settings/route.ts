import { NextResponse } from 'next/server';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';

/**
 * GET /api/app-settings
 * Get public application settings
 *
 * ✅ SECURITY FIX #6: Filter sensitive configuration data
 * Only returns public settings needed for the frontend.
 * Does NOT expose:
 * - Internal configuration
 * - Payment gateway credentials
 * - Email server configuration
 * - Security settings
 * - Admin-only configuration
 */
export async function GET() {
  try {
    const settings = await getAppSettings();

    // ✅ SECURITY FIX #6: Filter and return only public settings
    const publicSettings = {
      // Public currency configuration
      currency: settings.currency,
      currencies: settings.currencies,

      // Public MLM configuration
      teamLevelsVisible: settings.teamLevelsVisible,

      // E-commerce configuration
      ecommerceCommissionRate: settings.ecommerceCommissionRate,

      // Public feature flags (if any)
      // Add only necessary public configuration here

      // ❌ DO NOT expose:
      // - levelEarnings (internal commission structure)
      // - maxMembersPerLevel (internal capacity limits)
      // - payoutFrequency (internal payment settings)
      // - autoAdvanceEnabled (internal feature flag)
      // - Payment provider configurations
      // - Email settings
      // - Security settings
      // - Admin settings
    };

    return NextResponse.json({ settings: publicSettings });
  } catch (error) {
    console.error('[PublicAppSettings] Failed to load settings', error);
    return NextResponse.json(
      { error: 'Unable to load the application settings.' },
      { status: 500 },
    );
  }
}
