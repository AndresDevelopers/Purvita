import { cache } from 'react';
import type { Metadata } from 'next';

import { i18n, type Locale } from '@/i18n/config';
import { getSiteBranding } from '@/modules/site-content/services/site-content-service';
import type { Seo } from '@/lib/models/definitions';
import { getSeoEntry, getSeoFallback } from '@/lib/services/seo-service';
import {
  SEO_PAGE_DEFINITIONS,
  type SeoPageDefinition,
  type SeoPageId,
  resolveSeoPageIdFromPath,
} from './seo-definitions';

interface SeoPayload {
  metadata: Metadata;
  structuredData: string | null;
  pageId: SeoPageId;
  definition: SeoPageDefinition;
  record: Seo | null;
}

const getBranding = cache(async () => getSiteBranding());

const getDefinition = (pageId: SeoPageId): SeoPageDefinition => {
  const definition = SEO_PAGE_DEFINITIONS.find((item) => item.id === pageId);
  if (!definition) {
    throw new Error(`Missing SEO definition for page ${pageId}`);
  }
  return definition;
};

const mergeWithFallback = async (
  pageId: SeoPageId,
  locale: Locale,
): Promise<Seo | null> => {
  const pageSpecific = await getSeoEntry(pageId, locale);
  if (pageSpecific) {
    return pageSpecific;
  }

  const localeFallback = await getSeoFallback(locale);
  if (localeFallback) {
    return { ...localeFallback, page: pageId };
  }

  if (locale !== i18n.defaultLocale) {
    const defaultFallback = await getSeoFallback(i18n.defaultLocale);
    if (defaultFallback) {
      return { ...defaultFallback, page: pageId, locale: i18n.defaultLocale };
    }
  }

  return null;
};

const extractKeywords = (value: string | null | undefined): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const terms = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return terms.length > 0 ? terms : undefined;
};

const getBaseUrl = (): URL | undefined => {
  try {
    const { getAppUrl } = require('@/lib/env');
    const raw = getAppUrl();
    return new URL(raw);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[SEO] Failed to get app URL, omitting metadataBase', error);
    }
    return undefined;
  }
};

/**
 * Normalizes URL to remove www subdomain for canonical URLs
 */
const normalizeCanonicalUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Remove www. from hostname if present
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    return urlObj.toString();
  } catch {
    return url;
  }
};

const buildMetadata = async (
  definition: SeoPageDefinition,
  record: Seo | null,
  locale: Locale,
  pathname: string,
): Promise<Metadata> => {
  const branding = await getBranding();
  const baseUrl = getBaseUrl();

  // Normalize canonical URL to remove www
  const canonicalFromRecord = record?.canonical_url ?? null;
  let canonical: string | undefined;
  if (canonicalFromRecord) {
    canonical = normalizeCanonicalUrl(canonicalFromRecord);
  } else if (baseUrl) {
    const baseUrlNormalized = normalizeCanonicalUrl(baseUrl.origin);
    canonical = `${baseUrlNormalized}${pathname}`;
  }

  const effectiveTitle = record?.title ?? branding.appName;
  const effectiveDescription = record?.description ?? branding.description ?? '';
  const openGraphImage = record?.og_image ?? undefined;
  const twitterImage = record?.twitter_image ?? openGraphImage;
  const keywords = extractKeywords(record?.keywords);

  // Build hreflang alternate URLs for all locales
  const { i18n } = await import('@/i18n/config');
  const pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
  const languages: Record<string, string> = {};

  if (baseUrl) {
    const baseUrlNormalized = normalizeCanonicalUrl(baseUrl.origin);

    // Add hreflang for each locale
    for (const loc of i18n.locales) {
      const localizedPath = `/${loc}${pathnameWithoutLocale === '/' ? '' : pathnameWithoutLocale}`;
      languages[loc] = `${baseUrlNormalized}${localizedPath}`;
    }

    // Add x-default hreflang pointing to default locale
    const defaultLocalePath = `/${i18n.defaultLocale}${pathnameWithoutLocale === '/' ? '' : pathnameWithoutLocale}`;
    languages['x-default'] = `${baseUrlNormalized}${defaultLocalePath}`;
  }

  return {
    title: effectiveTitle,
    description: effectiveDescription,
    keywords,
    metadataBase: baseUrl,
    alternates: {
      ...(canonical ? { canonical } : {}),
      ...(Object.keys(languages).length > 0 ? { languages } : {}),
    },
    robots: {
      index: record?.robots_index ?? true,
      follow: record?.robots_follow ?? true,
      ...(record?.robots_advanced ? { googleBot: record.robots_advanced } : {}),
    },
    openGraph: {
      title: record?.og_title ?? effectiveTitle,
      description: record?.og_description ?? effectiveDescription,
      url: canonical,
      type: definition.category === 'marketing' ? 'website' : 'article',
      locale,
      siteName: branding.appName,
      ...(openGraphImage ? { images: [{ url: openGraphImage }] } : {}),
    },
    twitter: {
      card: twitterImage ? 'summary_large_image' : 'summary',
      title: record?.twitter_title ?? effectiveTitle,
      description: record?.twitter_description ?? effectiveDescription,
      ...(twitterImage ? { images: [twitterImage] } : {}),
    },
  } satisfies Metadata;
};

export const getSeoPayloadForPath = cache(
  async (pathname: string, locale: Locale): Promise<SeoPayload> => {
    const pageId = resolveSeoPageIdFromPath(pathname) as SeoPageId;
    const definition = getDefinition(pageId);
    const record = await mergeWithFallback(pageId, locale);
    const metadata = await buildMetadata(definition, record, locale, pathname);

    return {
      metadata,
      structuredData: record?.json_ld ?? null,
      pageId,
      definition,
      record,
    };
  },
);

export const getSeoPayloadForPage = cache(
  async (pageId: SeoPageId, locale: Locale, pathname: string): Promise<SeoPayload> => {
    const definition = getDefinition(pageId);
    const record = await mergeWithFallback(pageId, locale);
    const metadata = await buildMetadata(definition, record, locale, pathname);

    return {
      metadata,
      structuredData: record?.json_ld ?? null,
      pageId,
      definition,
      record,
    };
  },
);

export const getSeoDefinition = getDefinition;
export { resolveSeoPageIdFromPath } from './seo-definitions';
