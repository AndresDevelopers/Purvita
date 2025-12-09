import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase';
import { validateLocale } from '@/modules/site-content/services/site-content-service';
import { getSiteBranding } from '@/modules/site-content/services/site-content-service';
import {
  getStaticPages,
  updateStaticPages,
} from '@/modules/site-content/services/static-pages-service';
import { StaticPagesUpdateSchema } from '@/modules/site-content/domain/models/static-pages';
import { withAdminAuth } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

export const GET = withAdminAuth<any>(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const locale = validateLocale(searchParams.get('locale'));
    const branding = await getSiteBranding();
    const staticPages = await getStaticPages(locale, branding.appName);

    return NextResponse.json(staticPages);
  } catch (error) {
    console.error('[API] Failed to load static pages', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
});

export const PUT = withAdminAuth<any>(async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  // Check if service role client is available for admin operations
  if (!getServiceRoleClient()) {
    console.error('[API] Service role client not available for admin operations');
    return NextResponse.json(
      {
        error: 'Service role credentials not configured',
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { locale: localeParam, ...payload } = body;
    const locale = validateLocale(localeParam ?? null);

    const validated = StaticPagesUpdateSchema.parse(payload);
    await updateStaticPages(locale, validated);

    const branding = await getSiteBranding();
    const updated = await getStaticPages(locale, branding.appName);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated static pages',
      {
        ...extractRequestMetadata(request),
        action: 'update_static_pages',
        resourceType: 'static_pages',
        locale: locale,
      },
      true
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API] Failed to update static pages', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid payload',
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
});

