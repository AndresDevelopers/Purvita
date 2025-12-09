import { NextResponse } from 'next/server';
import { i18n, type Locale } from '@/i18n/config';
import { getTeamPageContent } from '@/modules/site-content/services/team-page-service';

const ensureLocale = (value: string | undefined, fallback: Locale): Locale => {
  if (!value) {
    return fallback;
  }

  return (i18n.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : fallback;
};

/**
 * GET /api/public/team-page
 * Public endpoint to fetch team page content for a specific locale
 */
export async function GET(request: Request) {
  try {
    // Get locale from query params
    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get('locale');
    const locale = ensureLocale(localeParam ?? undefined, i18n.defaultLocale);

    // Fetch team page content
    const content = await getTeamPageContent(locale);

    return NextResponse.json(content);
  } catch (error) {
    console.error('Error fetching team page content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team page content' },
      { status: 500 },
    );
  }
}

