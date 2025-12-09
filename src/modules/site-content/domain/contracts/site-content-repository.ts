import type { Locale } from '@/i18n/config';
import type { SiteBranding, SiteBrandingUpdateInput } from '../models/site-branding';
import type {
  LandingContentPayload,
  LandingContentRecord,
} from '../models/landing-content';
import type { StaticPages, StaticPagesUpdateInput } from '../models/static-pages';
import type { AffiliatePageConfig } from '../models/affiliate-page-config';

export interface SiteContentRepository {
  fetchBranding(): Promise<SiteBranding | null>;
  upsertBranding(input: SiteBrandingUpdateInput): Promise<SiteBranding>;
  fetchLandingContent(locale: Locale): Promise<LandingContentRecord | null>;
  upsertLandingContent(locale: Locale, payload: LandingContentPayload): Promise<LandingContentRecord>;
  fetchStaticPages(locale: Locale): Promise<Partial<StaticPages> | null>;
  updateStaticPages(locale: Locale, payload: StaticPagesUpdateInput): Promise<void>;
  fetchAffiliatePageConfig(): Promise<AffiliatePageConfig | null>;
  upsertAffiliatePageConfig(config: AffiliatePageConfig): Promise<AffiliatePageConfig>;
}
