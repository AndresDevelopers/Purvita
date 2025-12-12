import { NextResponse } from 'next/server';
import { z } from 'zod';
import { i18n, type Locale } from '@/i18n/config';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import {
  getTeamPageContent,
  updateTeamPageContent,
} from '@/modules/site-content/services/team-page-service';
import { TeamPageContentUpdateSchema } from '@/modules/site-content/domain/models/team-page';

const ensureLocale = (value: string | undefined, fallback: Locale): Locale => {
  if (!value) {
    return fallback;
  }

  return (i18n.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : fallback;
};

/**
 * GET /api/admin/team-page
 * Fetch team page content for a specific locale
 */
export const GET = withAdminPermission('access_admin_panel', async (request) => {
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
});

/**
 * POST /api/admin/team-page
 * Update team page content for a specific locale
 */
export const POST = withAdminPermission('access_admin_panel', async (request) => {
  // Verify CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    // Parse request body
    const body = await request.json();

    // Validate request schema
    const RequestSchema = z.object({
      locale: z.string(),
      teamPage: TeamPageContentUpdateSchema,
    });

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { locale: localeParam, teamPage } = parsed.data;
    const locale = ensureLocale(localeParam, i18n.defaultLocale);

    // Update team page content
    const updated = await updateTeamPageContent(locale, teamPage);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating team page content:', error);
    return NextResponse.json(
      { error: 'Failed to update team page content' },
      { status: 500 },
    );
  }
});

