/**
 * SEO Metadata Generator for Affiliate Stores
 *
 * Generates optimized metadata for affiliate stores including:
 * - Open Graph tags
 * - Twitter Card tags
 * - Schema.org structured data
 * - Canonical URLs
 */

import type { Metadata } from 'next';
import { getAppUrl } from '@/lib/env';

export interface AffiliateSEOData {
  referralCode: string;
  sponsorName: string | null;
  storeTitle: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  productCount: number;
  lang: string;
  // Optional custom slug for public URLs. If not set, referralCode is used.
  storeSlug?: string | null;
  sponsorId?: string; // For tracking
  createdAt?: string; // For tracking
  seoKeywords?: string | null; // Custom SEO keywords (comma-separated)
}

/**
 * Generates metadata for affiliate store pages
 */
export function generateAffiliateMetadata(data: AffiliateSEOData): Metadata {
  const baseUrl = getAppUrl();
  const storeName = data.storeTitle || `${data.sponsorName}'s Store` || 'Affiliate Store';
  const description = `Discover ${data.productCount} premium products at ${storeName}. Shop wellness and health products with exclusive affiliate benefits.`;
  const pathSegment = data.storeSlug || data.referralCode;
  const url = `${baseUrl}/${data.lang}/affiliate/${pathSegment}`;
  const imageUrl = data.bannerUrl || data.logoUrl || `${baseUrl}/og-affiliate.jpg`;

  // Use custom keywords if provided, otherwise use defaults
  const keywords = data.seoKeywords
    ? data.seoKeywords.split(',').map(k => k.trim()).filter(Boolean)
    : [
        'affiliate store',
        'wellness products',
        'health supplements',
        'PurVita',
        data.sponsorName || '',
        'multilevel marketing',
        'network marketing',
      ].filter(Boolean);

  return {
    title: `${storeName} | PurVita Affiliate Store`,
    description,
    keywords,
    authors: [{ name: data.sponsorName || 'PurVita Affiliate' }],
    creator: data.sponsorName || 'PurVita Affiliate',
    publisher: 'PurVita',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: url,
      languages: {
        'en-US': `/en/affiliate/${pathSegment}`,
        'es-ES': `/es/affiliate/${pathSegment}`,
      },
    },
    openGraph: {
      type: 'website',
      url,
      title: storeName,
      description,
      siteName: 'PurVita',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${storeName} Banner`,
        },
      ],
      locale: data.lang === 'es' ? 'es_ES' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: storeName,
      description,
      images: [imageUrl],
      creator: '@purvita',
      site: '@purvita',
    },
  };
}

/**
 * Generates Schema.org structured data for affiliate stores
 */
export function generateAffiliateSchema(data: AffiliateSEOData) {
  const baseUrl = getAppUrl();
  const pathSegment = data.storeSlug || data.referralCode;

  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: data.storeTitle || `${data.sponsorName}'s Store`,
    description: `Premium wellness and health products curated by ${data.sponsorName || 'our affiliate'}`,
    url: `${baseUrl}/${data.lang}/affiliate/${pathSegment}`,
    image: data.bannerUrl || data.logoUrl,
    logo: data.logoUrl,
    brand: {
      '@type': 'Brand',
      name: 'PurVita',
    },
    parentOrganization: {
      '@type': 'Organization',
      name: 'PurVita',
      url: baseUrl,
    },
    potentialAction: {
      '@type': 'BuyAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/${data.lang}/affiliate/${pathSegment}/cart`,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
    },
  };
}

/**
 * Generates product list schema for affiliate stores
 */
export function generateProductListSchema(
  data: AffiliateSEOData,
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
  }>
) {
  const baseUrl = getAppUrl();

  const pathSegment = data.storeSlug || data.referralCode;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Products at ${data.storeTitle || `${data.sponsorName}'s Store`}`,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        description: product.description || `Premium ${product.name} from PurVita`,
        image: product.imageUrl,
        offers: {
          '@type': 'Offer',
          price: (product.price / 100).toFixed(2),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: `${baseUrl}/${data.lang}/affiliate/${pathSegment}/product/${product.id}`,
        },
      },
    })),
  };
}

/**
 * Generates security and tracking metadata for affiliate pages
 *
 * This metadata helps with:
 * - Security monitoring and audit trails
 * - Analytics and conversion tracking
 * - Fraud detection and prevention
 */
export function generateAffiliateTrackingMetadata(data: AffiliateSEOData) {
  return {
    // Security metadata
    'x-affiliate-code': data.referralCode,
    'x-store-created': data.createdAt || new Date().toISOString(),

    // Tracking metadata for analytics
    'data-affiliate-tracking': JSON.stringify({
      referralCode: data.referralCode,
      storeSlug: data.storeSlug || null,
      storeName: data.storeTitle || data.sponsorName,
      lang: data.lang,
      productCount: data.productCount,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Generates security headers for affiliate pages
 *
 * These headers enhance security for affiliate stores
 */
export function generateAffiliateSecurityHeaders() {
  return {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Referrer policy for privacy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy (restrict features)
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}

