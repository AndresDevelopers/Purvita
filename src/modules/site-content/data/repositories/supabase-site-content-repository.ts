import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/i18n/config';
import type { SiteContentRepository } from '../../domain/contracts/site-content-repository';
import {
  SiteBrandingSchema,
  SiteBrandingUpdateSchema,
  type SiteBranding,
  type SiteBrandingUpdateInput,
} from '../../domain/models/site-branding';
import {
  LandingContentPayloadSchema,
  type LandingContentPayload,
  type LandingContentRecord,
} from '../../domain/models/landing-content';
import type { StaticPages, StaticPagesUpdateInput } from '../../domain/models/static-pages';
import type { AffiliatePageConfig } from '../../domain/models/affiliate-page-config';

export interface SupabaseSiteContentRepositoryDependencies {
  adminClient: SupabaseClient;
}

const BRANDING_COLUMNS =
  'app_name, logo_url, favicon_url, description, show_logo, logo_position, show_app_name, updated_at';

type BrandingRow = {
  app_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  description: string | null;
  show_logo: boolean;
  logo_position: string;
  show_app_name: boolean;
  updated_at: string | null;
};

const mapBrandingRowToEntity = (row: Partial<BrandingRow>) =>
  SiteBrandingSchema.parse({
    appName: row.app_name ?? '',
    logoUrl: row.logo_url ?? null,
    faviconUrl: row.favicon_url ?? null,
    description: row.description ?? null,
    showLogo: row.show_logo ?? true,
    logoPosition: (row.logo_position as SiteBranding['logoPosition']) ?? 'beside',
    showAppName: row.show_app_name ?? true,
    updatedAt: row.updated_at ?? null,
  });

export class SupabaseSiteContentRepository implements SiteContentRepository {
  constructor(private readonly deps: SupabaseSiteContentRepositoryDependencies) { }

  private get client(): SupabaseClient {
    return this.deps.adminClient;
  }

  async fetchBranding(): Promise<SiteBranding | null> {
    try {
      const { data, error } = await this.client
        .from('site_branding_settings')
        .select(BRANDING_COLUMNS)
        .eq('id', 'global')
        .maybeSingle();

      if (error) {
        // Handle table not found or schema cache errors gracefully
        if (error.code === 'PGRST116' ||
          error.message?.includes("Could not find the table") ||
          error.message?.includes("schema cache") ||
          error.message?.includes("relation") && error.message?.includes("does not exist")) {
          return null;
        }

        if (error.message?.includes('favicon_url')) {
          console.warn('[SiteContentRepository] favicon_url column missing, falling back without favicon support.');

          const { data: fallbackData, error: fallbackError } = await this.client
            .from('site_branding_settings')
            .select('app_name, logo_url, description, show_logo, logo_position, show_app_name, updated_at')
            .eq('id', 'global')
            .maybeSingle();

          if (!fallbackError && fallbackData) {
            return mapBrandingRowToEntity({
              ...(fallbackData as BrandingRow),
              favicon_url: null,
            });
          }
        }

        throw new Error(`[SiteContentRepository] Failed to load branding: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return mapBrandingRowToEntity(data as BrandingRow);
    } catch (err) {
      // If any unexpected error occurs (like network issues during build), return null
      console.warn('[SiteContentRepository] Unexpected error loading branding, using defaults:', err);
      return null;
    }
  }

  async upsertBranding(input: SiteBrandingUpdateInput): Promise<SiteBranding> {
    const payload = SiteBrandingUpdateSchema.parse(input);

    console.log('[SiteContentRepository] Upserting branding with payload:', {
      id: 'global',
      app_name: payload.appName,
      logo_url: payload.logoUrl ?? null,
      favicon_url: payload.faviconUrl ?? null,
      description: payload.description ?? null,
      show_logo: payload.showLogo,
      logo_position: payload.logoPosition,
      show_app_name: payload.showAppName,
      updated_at: new Date().toISOString(),
    });

    const { data, error } = await this.client
      .from('site_branding_settings')
      .upsert(
        {
          id: 'global',
          app_name: payload.appName,
          logo_url: payload.logoUrl ?? null,
          favicon_url: payload.faviconUrl ?? null,
          description: payload.description ?? null,
          show_logo: payload.showLogo,
          logo_position: payload.logoPosition,
          show_app_name: payload.showAppName,
          updated_at: new Date().toISOString(),
        }
      )
      .select(BRANDING_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[SiteContentRepository] Branding upsert error:', error);
      throw new Error(`[SiteContentRepository] Failed to update branding: ${error.message}`);
    }

    if (!data) {
      console.error('[SiteContentRepository] Branding upsert returned no data');
      throw new Error('[SiteContentRepository] Branding update returned no data');
    }

    console.log('[SiteContentRepository] Branding upsert successful:', data);

    return mapBrandingRowToEntity(data as BrandingRow);
  }

  async fetchLandingContent(locale: Locale): Promise<LandingContentRecord | null> {
    try {
      const { data, error } = await this.client
        .from('landing_page_content')
        .select('locale, hero, about, how_it_works, opportunity, testimonials, featured_products, contact, team, header, footer, faqs, updated_at')
        .eq('locale', locale)
        .maybeSingle();

      if (error) {
        // Handle table not found or schema cache errors gracefully
        if (error.code === 'PGRST116' ||
          error.message?.includes("Could not find the table") ||
          error.message?.includes("schema cache") ||
          error.message?.includes("relation") && error.message?.includes("does not exist")) {
          return null;
        }

        throw new Error(`[SiteContentRepository] Failed to load landing content: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return data as LandingContentRecord;
    } catch (err) {
      // If any unexpected error occurs (like network issues during build), return null
      console.warn('[SiteContentRepository] Unexpected error loading landing content, using defaults:', err);
      return null;
    }
  }

  async upsertLandingContent(locale: Locale, payload: LandingContentPayload): Promise<LandingContentRecord> {
    const parsed = LandingContentPayloadSchema.parse(payload);

    console.log('[SiteContentRepository] Upserting landing content with payload:', {
      locale,
      hero: parsed.hero ?? null,
      about: parsed.about ?? null,
      how_it_works: parsed.howItWorks ?? null,
      opportunity: parsed.opportunity ?? null,
      testimonials: parsed.testimonials ?? null,
      featured_products: parsed.featuredProducts ?? null,
      contact: parsed.contact ?? null,
      team: parsed.team ?? null,
      header: parsed.header ?? null,
      footer: parsed.footer ?? null,
      faqs: parsed.faqs ?? [],
      updated_at: new Date().toISOString(),
    });

    const { data, error } = await this.client
      .from('landing_page_content')
      .upsert(
        {
          locale,
          hero: parsed.hero ?? null,
          about: parsed.about ?? null,
          how_it_works: parsed.howItWorks ?? null,
          opportunity: parsed.opportunity ?? null,
          testimonials: parsed.testimonials ?? null,
          featured_products: parsed.featuredProducts ?? null,
          contact: parsed.contact ?? null,
          team: parsed.team ?? null,
          header: parsed.header ?? null,
          footer: parsed.footer ?? null,
          faqs: parsed.faqs ?? [],
          updated_at: new Date().toISOString(),
        }
      )
      .select('locale, hero, about, how_it_works, opportunity, testimonials, featured_products, contact, team, header, footer, faqs, updated_at')
      .maybeSingle();

    if (error) {
      console.error('[SiteContentRepository] Landing content upsert error:', error);
      throw new Error(`[SiteContentRepository] Failed to update landing content: ${error.message}`);
    }

    if (!data) {
      console.error('[SiteContentRepository] Landing content upsert returned no data');
      throw new Error('[SiteContentRepository] Landing content update returned no data');
    }

    console.log('[SiteContentRepository] Landing content upsert successful:', data);

    return data as LandingContentRecord;
  }

  async fetchStaticPages(locale: Locale): Promise<Partial<StaticPages> | null> {
    const { data, error } = await this.client
      .from('static_pages_content')
      .select('locale, content, updated_at')
      .eq('locale', locale)
      .maybeSingle();

    if (error) {
      console.error('[SiteContentRepository] Static pages fetch error:', error);
      return null;
    }

    if (!data || !data.content) {
      return null;
    }

    return {
      locale: data.locale,
      ...data.content,
      updatedAt: data.updated_at,
    };
  }

  async updateStaticPages(locale: Locale, payload: StaticPagesUpdateInput): Promise<void> {
    const { error } = await this.client
      .from('static_pages_content')
      .upsert({
        locale,
        content: payload,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[SiteContentRepository] Static pages update error:', error);
      throw new Error(`[SiteContentRepository] Failed to update static pages: ${error.message}`);
    }
  }

  async fetchAffiliatePageConfig(): Promise<AffiliatePageConfig | null> {
    try {
      const { data, error } = await this.client
        .from('affiliate_page_settings')
        .select('config')
        .eq('id', 'global')
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' ||
          error.message?.includes("Could not find the table") ||
          error.message?.includes("relation") && error.message?.includes("does not exist")) {
          return null;
        }
        throw new Error(`[SiteContentRepository] Failed to load affiliate config: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return data.config as AffiliatePageConfig;
    } catch (err) {
      console.warn('[SiteContentRepository] Unexpected error loading affiliate config:', err);
      return null;
    }
  }

  async upsertAffiliatePageConfig(config: AffiliatePageConfig): Promise<AffiliatePageConfig> {
    const { data, error } = await this.client
      .from('affiliate_page_settings')
      .upsert({
        id: 'global',
        config,
        updated_at: new Date().toISOString(),
      })
      .select('config')
      .single();

    if (error) {
      console.error('[SiteContentRepository] Affiliate config upsert error:', error);
      throw new Error(`[SiteContentRepository] Failed to update affiliate config: ${error.message}`);
    }

    return data.config as AffiliatePageConfig;
  }
}
