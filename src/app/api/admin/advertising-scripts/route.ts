import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAdminPermission } from '@/lib/auth/with-auth';
import {
  getAdvertisingScripts,
  updateAdvertisingScripts,
} from '@/modules/advertising/services/advertising-scripts-service';
import { AdvertisingScriptsUpdateSchema } from '@/modules/advertising/domain/models/advertising-scripts';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * GET /api/admin/advertising-scripts
 * Get advertising scripts configuration
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async () => {
  try {
    const config = await getAdvertisingScripts();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[API] Failed to load advertising scripts configuration', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/advertising-scripts
 * Update advertising scripts configuration
 * Requires: manage_content permission
 */
export const PUT = withAdminPermission('manage_content', async (request: Request) => {
  // Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const validated = AdvertisingScriptsUpdateSchema.parse(body);
    const updated = await updateAdvertisingScripts(validated);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated advertising scripts',
      {
        ...extractRequestMetadata(request),
        action: 'update_advertising_scripts',
        resourceType: 'advertising_scripts',
        facebookPixelEnabled: validated.facebookPixelEnabled,
        tiktokPixelEnabled: validated.tiktokPixelEnabled,
        gtmEnabled: validated.gtmEnabled,
      },
      true
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[API] Failed to update advertising scripts configuration', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

