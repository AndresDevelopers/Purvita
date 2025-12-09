import { NextResponse } from 'next/server';

import { getSeoSettings, upsertSeoSettings } from '@/lib/services/seo-service';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * GET /api/admin/seo
 * Get SEO settings
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async () => {
  try {
    const settings = await getSeoSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('API error in GET /api/admin/seo:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

/**
 * PUT /api/admin/seo
 * Update SEO settings
 * Requires: manage_content permission
 */
export const PUT = withAdminPermission('manage_content', async (request: Request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const updated = await upsertSeoSettings(body);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated SEO settings',
      {
        ...extractRequestMetadata(request),
        action: 'update_seo_settings',
        resourceType: 'seo_settings',
      },
      true
    );

    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error('API error in PUT /api/admin/seo:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});