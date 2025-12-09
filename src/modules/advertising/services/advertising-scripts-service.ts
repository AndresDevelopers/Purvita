import { getServiceRoleClient } from '@/lib/supabase';
import {
  AdvertisingScriptsSchema,
  DEFAULT_ADVERTISING_SCRIPTS,
  type AdvertisingScripts,
  type AdvertisingScriptsUpdateInput,
} from '../domain/models/advertising-scripts';

/**
 * Map database row to domain model
 */
function mapRowToModel(row: any): AdvertisingScripts {
  return {
    id: row.id,
    facebookPixelEnabled: row.facebook_pixel_enabled ?? false,
    facebookPixelId: row.facebook_pixel_id ?? null,
    facebookPixelScript: row.facebook_pixel_script ?? null,
    tiktokPixelEnabled: row.tiktok_pixel_enabled ?? false,
    tiktokPixelId: row.tiktok_pixel_id ?? null,
    tiktokPixelScript: row.tiktok_pixel_script ?? null,
    gtmEnabled: row.gtm_enabled ?? false,
    gtmContainerId: row.gtm_container_id ?? null,
    gtmScript: row.gtm_script ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Map domain model to database row
 */
function mapModelToRow(model: AdvertisingScriptsUpdateInput): any {
  return {
    facebook_pixel_enabled: model.facebookPixelEnabled,
    facebook_pixel_id: model.facebookPixelId,
    facebook_pixel_script: model.facebookPixelScript,
    tiktok_pixel_enabled: model.tiktokPixelEnabled,
    tiktok_pixel_id: model.tiktokPixelId,
    tiktok_pixel_script: model.tiktokPixelScript,
    gtm_enabled: model.gtmEnabled,
    gtm_container_id: model.gtmContainerId,
    gtm_script: model.gtmScript,
  };
}

/**
 * Get advertising scripts configuration
 */
export async function getAdvertisingScripts(): Promise<AdvertisingScripts> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('advertising_scripts')
    .select('*')
    .eq('id', 'global')
    .single();

  if (error) {
    console.error('[AdvertisingScripts] Error fetching configuration:', error);
    return DEFAULT_ADVERTISING_SCRIPTS;
  }

  if (!data) {
    return DEFAULT_ADVERTISING_SCRIPTS;
  }

  const mapped = mapRowToModel(data);
  const validated = AdvertisingScriptsSchema.parse(mapped);
  return validated;
}

/**
 * Update advertising scripts configuration
 */
export async function updateAdvertisingScripts(
  input: AdvertisingScriptsUpdateInput
): Promise<AdvertisingScripts> {
  const supabase = getServiceRoleClient();

  const row = mapModelToRow(input);

  const { data, error } = await supabase
    .from('advertising_scripts')
    .update(row)
    .eq('id', 'global')
    .select()
    .single();

  if (error) {
    console.error('[AdvertisingScripts] Error updating configuration:', error);
    throw new Error('Failed to update advertising scripts configuration');
  }

  const mapped = mapRowToModel(data);
  const validated = AdvertisingScriptsSchema.parse(mapped);
  return validated;
}

/**
 * Get public advertising scripts (for client-side injection)
 * Only returns enabled scripts
 */
export async function getPublicAdvertisingScripts(): Promise<{
  facebookPixel: { enabled: boolean; id: string | null; script: string | null };
  tiktokPixel: { enabled: boolean; id: string | null; script: string | null };
  gtm: { enabled: boolean; containerId: string | null; script: string | null };
}> {
  const config = await getAdvertisingScripts();

  return {
    facebookPixel: {
      enabled: config.facebookPixelEnabled,
      id: config.facebookPixelId ?? null,
      script: config.facebookPixelScript ?? null,
    },
    tiktokPixel: {
      enabled: config.tiktokPixelEnabled,
      id: config.tiktokPixelId ?? null,
      script: config.tiktokPixelScript ?? null,
    },
    gtm: {
      enabled: config.gtmEnabled,
      containerId: config.gtmContainerId ?? null,
      script: config.gtmScript ?? null,
    },
  };
}

