import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/env';
import { i18n } from '@/i18n/config';
import { getAdminBypassUrl } from '@/lib/utils/admin-bypass-url';

/**
 * Normalizes URL to remove www subdomain
 */
const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    return urlObj.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
};

/**
 * Dynamic robots.txt generator
 *
 * Provides search engine crawling instructions and sitemap location.
 * Blocks admin areas, API routes, and private sections.
 * Uses dynamic locale configuration.
 */
export async function GET() {
  const baseUrl = normalizeUrl(getAppUrl());
  const bypassUrl = getAdminBypassUrl();

  // Generate Allow directives for all configured locales
  const localeAllowRules = i18n.locales
    .map(locale => `Allow: /${locale}/`)
    .join('\n');

  const robotsTxt = `# Robots.txt for PūrVita
# Generated dynamically

# Allow all bots to crawl public content
User-agent: *
Allow: /
${localeAllowRules}

# Block admin and private areas
Disallow: /admin/
Disallow: /${bypassUrl}/
Disallow: /api/
Disallow: /payment/
Disallow: /_next/
Disallow: /[bypassPath]/

# Block authentication pages from indexing
Disallow: /*/login
Disallow: /*/register
Disallow: /*/logout
Disallow: /*/auth/

# Block private user areas
Disallow: /*/dashboard
Disallow: /*/profile
Disallow: /*/wallet
Disallow: /*/settings
Disallow: /*/orders
Disallow: /*/subscription
Disallow: /*/checkout
Disallow: /*/cart

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay for AI bots to reduce server load
User-agent: GPTBot
Crawl-delay: 10

User-agent: CCBot
Crawl-delay: 10

User-agent: anthropic-ai
Crawl-delay: 10

User-agent: Claude-Web
Crawl-delay: 10

User-agent: Google-Extended
Crawl-delay: 10

# Allow Google and Bing full access
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Allow SEO analysis tools with crawl delay to reduce server load
User-agent: AhrefsBot
Crawl-delay: 10
Allow: /

User-agent: SemrushBot
Crawl-delay: 10
Allow: /

User-agent: DotBot
Crawl-delay: 10
Allow: /
`;

  return new NextResponse(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}

export const dynamic = 'force-static';
export const revalidate = 86400; // Revalidate once per day

