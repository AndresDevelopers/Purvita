import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  getSiteModeConfiguration,
  updateSiteModeConfiguration,
} from '@/modules/site-status/services/site-mode-service';
import { withAdminAuth } from '@/lib/utils/admin-route-helper';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

export const GET = withAdminAuth(async () => {
  try {
    const configuration = await getSiteModeConfiguration();
    return NextResponse.json(configuration);
  } catch (error) {
    console.error('[API] Failed to load site status configuration', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
});

export const PUT = withAdminAuth(async (request: Request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const body = await request.json();
    console.log('[API] Received payload:', JSON.stringify(body, null, 2));
    const configuration = await updateSiteModeConfiguration(body);

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Admin updated site mode configuration',
      {
        ...extractRequestMetadata(request),
        action: 'update_site_mode_configuration',
        resourceType: 'site_configuration',
        configuration: body,
      },
      true
    );

    return NextResponse.json(configuration);
  } catch (error) {
    console.error('[API] Failed to update site status configuration', error);

    if (error instanceof ZodError) {
      console.error('[API] Zod validation errors:', JSON.stringify(error.flatten(), null, 2));
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
