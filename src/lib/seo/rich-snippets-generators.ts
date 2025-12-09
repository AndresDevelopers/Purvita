/**
 * Rich Snippets Generators
 * 
 * Generate Schema.org structured data for rich results in Google Search:
 * - FAQ (Frequently Asked Questions)
 * - HowTo (Step-by-step guides)
 * - Review/AggregateRating (Product reviews)
 * - Article (Blog posts, news)
 * - VideoObject (Video content)
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface HowToStep {
  name: string;
  text: string;
  image?: string;
  url?: string;
}

export interface Review {
  author: string;
  datePublished: string;
  reviewBody: string;
  reviewRating: number; // 1-5
}

/**
 * Generate FAQ Schema.org structured data
 * 
 * @see https://schema.org/FAQPage
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */
export function generateFAQSchema(faqs: FAQItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer,
      },
    })),
  };
}

/**
 * Generate HowTo Schema.org structured data
 * 
 * @see https://schema.org/HowTo
 * @see https://developers.google.com/search/docs/appearance/structured-data/how-to
 */
export function generateHowToSchema(
  name: string,
  description: string,
  steps: HowToStep[],
  totalTime?: string, // ISO 8601 duration format (e.g., "PT30M" for 30 minutes)
  image?: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': name,
    'description': description,
    ...(image && { 'image': image }),
    ...(totalTime && { 'totalTime': totalTime }),
    'step': steps.map((step, index) => ({
      '@type': 'HowToStep',
      'position': index + 1,
      'name': step.name,
      'text': step.text,
      ...(step.image && { 'image': step.image }),
      ...(step.url && { 'url': step.url }),
    })),
  };
}

/**
 * Generate AggregateRating Schema.org structured data
 * 
 * @see https://schema.org/AggregateRating
 */
export function generateAggregateRatingSchema(
  ratingValue: number,
  reviewCount: number,
  bestRating: number = 5,
  worstRating: number = 1
): Record<string, unknown> {
  return {
    '@type': 'AggregateRating',
    'ratingValue': ratingValue.toFixed(1),
    'reviewCount': reviewCount,
    'bestRating': bestRating,
    'worstRating': worstRating,
  };
}

/**
 * Generate Review Schema.org structured data
 * 
 * @see https://schema.org/Review
 */
export function generateReviewSchema(review: Review): Record<string, unknown> {
  return {
    '@type': 'Review',
    'author': {
      '@type': 'Person',
      'name': review.author,
    },
    'datePublished': review.datePublished,
    'reviewBody': review.reviewBody,
    'reviewRating': {
      '@type': 'Rating',
      'ratingValue': review.reviewRating,
      'bestRating': 5,
      'worstRating': 1,
    },
  };
}

/**
 * Generate Article Schema.org structured data
 * 
 * @see https://schema.org/Article
 * @see https://developers.google.com/search/docs/appearance/structured-data/article
 */
export function generateArticleSchema(
  headline: string,
  description: string,
  author: string,
  datePublished: string,
  dateModified: string,
  image: string,
  url: string,
  publisherName: string = 'PūrVita Network',
  publisherLogo: string = '/favicon.svg'
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': headline,
    'description': description,
    'image': image,
    'datePublished': datePublished,
    'dateModified': dateModified,
    'author': {
      '@type': 'Person',
      'name': author,
    },
    'publisher': {
      '@type': 'Organization',
      'name': publisherName,
      'logo': {
        '@type': 'ImageObject',
        'url': publisherLogo,
      },
    },
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': url,
    },
  };
}

