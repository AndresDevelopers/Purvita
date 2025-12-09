import { NextResponse } from 'next/server';
import type { Locale } from '@/i18n/config';
import { i18n } from '@/i18n/config';
import { getSiteContentConfiguration } from '@/modules/site-content/services/site-content-service';

/**
 * Ensures the locale is valid, falling back to default if invalid
 */
function ensureLocale(value: string | undefined, fallback: Locale): Locale {
  if (!value) {
    return fallback;
  }

  return (i18n.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : fallback;
}

/**
 * GET /api/public/site-content
 * Public endpoint to fetch site content configuration (branding + landing) for a specific locale
 * No authentication required - this is public data displayed on the landing page
 */
export async function GET(request: Request) {
  try {
    // Get locale from query params
    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get('locale');
    const locale = ensureLocale(localeParam ?? undefined, i18n.defaultLocale);

    // Fetch site content configuration (branding + landing)
    const configuration = await getSiteContentConfiguration(locale);

    return NextResponse.json(configuration);
  } catch (error) {
    console.error('Error fetching site content configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site content configuration' },
      { status: 500 },
    );
  }
}

