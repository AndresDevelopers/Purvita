import type { SupabaseClient } from '@supabase/supabase-js';
import type { SiteModeRepository } from '../../domain/contracts/site-mode-repository';
import {
  SiteModeConfiguration,
  SiteModeSettings,
  SiteModeSettingsSchema,
  SiteModeTypeSchema,
  SiteModeUpsertInput,
  SiteModeUpsertInputSchema,
  SiteModeComingSoonSettingsSchema,
  createDefaultConfiguration,
  createDefaultSeoSettings,
  createDefaultComingSoonSettings,
  SITE_MODE_SOCIAL_PLATFORM_LABELS,
  resolveSiteModeSocialPlatform,
  type SiteModeType,
  type SiteModeSocialLink,
} from '../../domain/models/site-mode';

export interface SupabaseSiteModeRepositoryDependencies {
  adminClient: SupabaseClient;
}

type SiteModeRow = {
  mode: SiteModeType;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  is_active: boolean | null;
  updated_at: string | null;
  background_image_url: string | null;
  background_overlay_opacity: number | null;
  social_links: unknown;
  mailchimp_enabled: boolean | null;
  mailchimp_audience_id: string | null;
  mailchimp_server_prefix: string | null;
  coming_soon_settings: unknown;
};

const sanitizeNullable = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const serializeSeoValue = (
  value: string | Record<string, string | null> | undefined | null
): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return sanitizeNullable(value);
  }

  if (typeof value === 'object') {
    try {
      return sanitizeNullable(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  return null;
};

const parseSocialLinks = (value: unknown): SiteModeSocialLink[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is { platform?: unknown; label?: unknown; url?: unknown } => typeof item === 'object' && item !== null)
    .map((item) => {
      const rawPlatform =
        typeof item.platform === 'string'
          ? item.platform
          : typeof item.label === 'string'
            ? item.label
            : '';
      const platform = resolveSiteModeSocialPlatform(rawPlatform);
      const url = typeof item.url === 'string' ? item.url.trim() : '';

      if (!platform || !url) {
        return null;
      }

      return { platform, url } as SiteModeSocialLink;
    })
    .filter((item): item is SiteModeSocialLink => item !== null);
};

const mapRowToSettings = (row: SiteModeRow): SiteModeSettings => {
  const parsedMode = SiteModeTypeSchema.safeParse(row.mode);
  const mode: SiteModeType = parsedMode.success ? parsedMode.data : 'maintenance';
  const defaults = createDefaultSeoSettings(mode);

  return SiteModeSettingsSchema.parse({
    mode,
    isActive: Boolean(row.is_active),
    seo: {
      title: row.meta_title ?? defaults.title,
      description: row.meta_description ?? defaults.description,
      keywords: row.meta_keywords ?? defaults.keywords,
      ogTitle: sanitizeNullable(row.og_title),
      ogDescription: sanitizeNullable(row.og_description),
      ogImage: sanitizeNullable(row.og_image),
      twitterTitle: sanitizeNullable(row.twitter_title),
      twitterDescription: sanitizeNullable(row.twitter_description),
      twitterImage: sanitizeNullable(row.twitter_image),
    },
    appearance: {
      backgroundImageUrl: sanitizeNullable(row.background_image_url),
      backgroundOverlayOpacity: typeof row.background_overlay_opacity === 'number'
        ? Math.max(0, Math.min(100, row.background_overlay_opacity))
        : 90,
      socialLinks: parseSocialLinks(row.social_links),
    },
    mailchimpEnabled: Boolean(row.mailchimp_enabled),
    mailchimpAudienceId: sanitizeNullable(row.mailchimp_audience_id),
    mailchimpServerPrefix: sanitizeNullable(row.mailchimp_server_prefix),
    comingSoon: (() => {
      try {
        return SiteModeComingSoonSettingsSchema.parse(
          row.coming_soon_settings ?? createDefaultComingSoonSettings(),
        );
      } catch (error) {
        console.error('[SiteModeRepository] Invalid coming soon settings payload', error);
        return createDefaultComingSoonSettings();
      }
    })(),
    updatedAt: row.updated_at,
  });
};

const mapInputToRow = (input: SiteModeUpsertInput): SiteModeRow => ({
  mode: input.mode,
  meta_title: serializeSeoValue(input.seo.title),
  meta_description: serializeSeoValue(input.seo.description),
  meta_keywords: serializeSeoValue(input.seo.keywords) ?? '',
  og_title: serializeSeoValue(input.seo.ogTitle ?? null),
  og_description: serializeSeoValue(input.seo.ogDescription ?? null),
  og_image: serializeSeoValue(input.seo.ogImage ?? null),
  twitter_title: serializeSeoValue(input.seo.twitterTitle ?? null),
  twitter_description: serializeSeoValue(input.seo.twitterDescription ?? null),
  twitter_image: serializeSeoValue(input.seo.twitterImage ?? null),
  is_active: Boolean(input.isActive),
  updated_at: new Date().toISOString(),
  background_image_url: sanitizeNullable(input.appearance.backgroundImageUrl ?? null),
  background_overlay_opacity: Math.max(0, Math.min(100, input.appearance.backgroundOverlayOpacity ?? 90)),
  social_links: (input.appearance.socialLinks ?? []).map((link) => ({
    platform: link.platform,
    label: SITE_MODE_SOCIAL_PLATFORM_LABELS[link.platform],
    url: link.url.trim(),
  })),
  mailchimp_enabled: Boolean(input.mailchimpEnabled),
  mailchimp_audience_id: sanitizeNullable(input.mailchimpAudienceId ?? null),
  mailchimp_server_prefix: sanitizeNullable(input.mailchimpServerPrefix ?? null),
  coming_soon_settings: SiteModeComingSoonSettingsSchema.parse(
    input.comingSoon ?? createDefaultComingSoonSettings(),
  ),
});

export class SupabaseSiteModeRepository implements SiteModeRepository {
  constructor(private readonly deps: SupabaseSiteModeRepositoryDependencies) {}

  getDefaultConfiguration(): SiteModeConfiguration {
    return createDefaultConfiguration();
  }

  async fetchAll(): Promise<SiteModeSettings[]> {
    const { data, error } = await this.deps.adminClient
      .from('site_mode_settings')
      .select('*')
      .order('mode', { ascending: true });

    if (error) {
      throw new Error(`[SiteModeRepository] Failed to fetch site modes: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row) => mapRowToSettings(row as SiteModeRow));
  }

  async upsertMany(payload: SiteModeUpsertInput[]): Promise<SiteModeSettings[]> {
    const parsed = payload.map((item) => SiteModeUpsertInputSchema.parse(item));

    const rows = parsed.map((item) => mapInputToRow(item));

    const { data, error } = await this.deps.adminClient
      .from('site_mode_settings')
      .upsert(rows, { onConflict: 'mode' })
      .select('*')
      .order('mode', { ascending: true });

    if (error) {
      throw new Error(`[SiteModeRepository] Failed to update site modes: ${error.message}`);
    }

    return (data ?? []).map((row) => mapRowToSettings(row as SiteModeRow));
  }
}
