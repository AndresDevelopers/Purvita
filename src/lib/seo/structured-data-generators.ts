import type { Product } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';

/**
 * Generate Product Schema.org structured data
 * 
 * Creates rich snippets for product pages including:
 * - Product information
 * - Pricing and availability
 * - Ratings and reviews
 * - Images
 * 
 * @see https://schema.org/Product
 */
export function generateProductSchema(
  product: Product,
  locale: Locale,
  baseUrl: string
): Record<string, unknown> {
  const productUrl = `${baseUrl}/${locale}/products/${product.slug}`;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.name,
    'description': product.description,
    'image': product.images.map(img => img.url),
    'sku': product.id,
    'mpn': product.id, // Manufacturer Part Number
    'brand': {
      '@type': 'Brand',
      'name': 'PūrVita Network',
    },
    'url': productUrl,
    'offers': {
      '@type': 'Offer',
      'url': productUrl,
      'priceCurrency': 'USD',
      'price': product.price.toFixed(2),
      'availability': product.stock_quantity > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      'priceValidUntil': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      'itemCondition': 'https://schema.org/NewCondition',
      'seller': {
        '@type': 'Organization',
        'name': 'PūrVita Network',
      },
    },
  };

  // Add category if available (from product metadata or tags)
  // Note: Uncomment when category field is added to Product type
  // if (product.category) {
  //   schema.category = product.category;
  // }

  // Add weight if available (from product metadata)
  // Note: Uncomment when weight field is added to Product type
  // if (product.weight) {
  //   schema.weight = {
  //     '@type': 'QuantitativeValue',
  //     'value': product.weight,
  //     'unitCode': 'GRM', // Grams
  //   };
  // }

  // Add aggregate rating if available
  if (product.experience?.rating?.average && product.experience?.rating?.count) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': product.experience.rating.average.toFixed(1),
      'reviewCount': product.experience.rating.count,
      'bestRating': 5,
      'worstRating': 1,
    };
  }

  // Add reviews if available
  if (product.experience?.reviews && product.experience.reviews.length > 0) {
    schema.review = product.experience.reviews.slice(0, 5).map(review => ({
      '@type': 'Review',
      'author': {
        '@type': 'Person',
        'name': review.author,
      },
      'reviewRating': {
        '@type': 'Rating',
        'ratingValue': review.rating,
        'bestRating': 5,
        'worstRating': 1,
      },
      'reviewBody': review.comment,
      ...(review.createdAt && { 'datePublished': review.createdAt }),
    }));
  }

  return schema;
}

/**
 * Generate Organization Schema.org structured data
 * 
 * Creates organization information for the website
 * 
 * @see https://schema.org/Organization
 */
export function generateOrganizationSchema(
  baseUrl: string,
  appName: string = 'PūrVita Network',
  description?: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': appName,
    'url': baseUrl,
    'logo': `${baseUrl}/favicon.svg`,
    ...(description && { 'description': description }),
    'sameAs': [
      // Add social media URLs when available
    ],
  };
}

/**
 * Generate WebSite Schema.org structured data
 * 
 * Creates website search box and basic info
 * 
 * @see https://schema.org/WebSite
 */
export function generateWebSiteSchema(
  baseUrl: string,
  appName: string = 'PūrVita Network'
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': appName,
    'url': baseUrl,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${baseUrl}/en/products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate BreadcrumbList Schema.org structured data
 * 
 * Creates breadcrumb navigation for better SEO
 * 
 * @see https://schema.org/BreadcrumbList
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.url,
    })),
  };
}

/**
 * Generate OfferCatalog Schema.org structured data
 * 
 * For product listing pages
 * 
 * @see https://schema.org/OfferCatalog
 */
export function generateOfferCatalogSchema(
  products: Product[],
  locale: Locale,
  baseUrl: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    'name': 'Product Catalog',
    'itemListElement': products.slice(0, 10).map((product, index) => ({
      '@type': 'Offer',
      'position': index + 1,
      'url': `${baseUrl}/${locale}/products/${product.slug}`,
      'name': product.name,
      'price': product.price.toFixed(2),
      'priceCurrency': 'USD',
    })),
  };
}

