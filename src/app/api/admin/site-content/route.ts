import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase';
import {
  getSiteContentConfiguration,
  updateSiteContentConfiguration,
  validateLocale,
  LandingContentUpdateSchema,
  type SiteContentConfiguration,
  type SiteContentConfigurationUpdateInput,
} from '@/modules/site-content/services/site-content-service';
import {
  SiteBrandingUpdateSchema,
  type SiteBrandingUpdateInput,
} from '@/modules/site-content/domain/models/site-branding';
import {
  AffiliatePageConfigSchema,
  type AffiliatePageConfig,
} from '@/modules/site-content/domain/models/affiliate-page-config';
import { withAdminAuth } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const UpdatePayloadSchema = z.object({
  locale: z.string().optional(),
  branding: SiteBrandingUpdateSchema,
  landing: LandingContentUpdateSchema,
  affiliatePageConfig: AffiliatePageConfigSchema.optional(),
});

type UpdatePayload = z.infer<typeof UpdatePayloadSchema>;

const createResponse = (
  locale: string,
  configuration: SiteContentConfiguration,
) => {
  return NextResponse.json({
    locale,
    branding: configuration.branding,
    landing: configuration.landing,
    affiliatePageConfig: configuration.affiliatePageConfig,
  });
};

export const GET = withAdminAuth<any>(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const locale = validateLocale(searchParams.get('locale'));
    const configuration = await getSiteContentConfiguration(locale);

    return createResponse(locale, configuration);
  } catch (error) {
    console.error('[API] Failed to load site content configuration', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
});

export const PUT = withAdminAuth<any>(async (request: Request) => {
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
    const payload = UpdatePayloadSchema.parse(body) as UpdatePayload;
    const locale = validateLocale(payload.locale ?? null);

    const updateInput: SiteContentConfigurationUpdateInput = {
      branding: payload.branding as SiteBrandingUpdateInput,
      landing: payload.landing,
      affiliatePageConfig: payload.affiliatePageConfig as AffiliatePageConfig,
    };

    const configuration = await updateSiteContentConfiguration(locale, updateInput);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated site content configuration',
      {
        ...extractRequestMetadata(request),
        action: 'update_site_content',
        resourceType: 'site_content',
        locale: locale,
      },
      true
    );

    return createResponse(locale, configuration);
  } catch (error) {
    console.error('[API] Failed to update site content configuration', {
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
