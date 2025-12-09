import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { createSiteContentModule } from '@/modules/site-content/factories/site-content-module';
import { createAppSettingsModule } from '@/modules/app-settings/factories/app-settings-module';
import type { SiteBranding } from '@/modules/site-content/domain/models/site-branding';

export const FALLBACK_BRANDING: SiteBranding = {
  appName: 'Invoice',
  logoUrl: null,
  faviconUrl: null,
  description: null,
  showLogo: false,
  logoPosition: 'beside',
  showAppName: true,
  updatedAt: null,
};

export const resolveAdminClient = async (fallback: SupabaseClient): Promise<SupabaseClient> => {
  try {
    return createAdminClient();
  } catch (error) {
    console.warn(
      'Service role client unavailable. Using user-scoped client for branding/app settings.',
      error,
    );
    return fallback;
  }
};

export const loadBranding = async (
  adminClient: SupabaseClient,
  supabaseClient: SupabaseClient,
): Promise<SiteBranding> => {
  try {
    const siteContentModule = createSiteContentModule({
      adminClient,
      componentClient: supabaseClient,
    });

    const branding = await siteContentModule.repository.fetchBranding();
    return branding ?? FALLBACK_BRANDING;
  } catch (error) {
    console.error('Failed to load site branding for invoice generation:', error);
    return FALLBACK_BRANDING;
  }
};

export const loadAppSettings = async (adminClient: SupabaseClient) => {
  try {
    const appSettingsModule = createAppSettingsModule({ adminClient });
    return appSettingsModule.repository.getSettings();
  } catch (error) {
    console.error('Failed to load app settings for invoice generation:', error);
    return null;
  }
};
