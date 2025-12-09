import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppSettingsUpdateSchema } from '@/modules/app-settings/domain/models/app-settings';
import { getAppSettings, updateAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { AdminAuthService } from '@/lib/services/admin-auth-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const RequestSchema = AppSettingsUpdateSchema;

/**
 * GET /api/admin/app-settings
 * Get application settings
 * Requires: manage_settings permission
 */
export async function GET() {
  try {
    // Verify admin access with permission
    await AdminAuthService.verifyAdminPermission('manage_settings');

    const settings = await getAppSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (error.message === 'Admin access required' || error.message.includes('permission required'))) {
      return NextResponse.json({ error: 'Forbidden: manage_settings permission required' }, { status: 403 });
    }

    console.error('[AppSettingsAPI] Failed to load settings', error);
    return NextResponse.json(
      { error: 'Unable to load the application settings.' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/app-settings
 * Update application settings
 * Requires: manage_settings permission
 */
export async function PUT(request: Request) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    // Verify admin access with permission
    await AdminAuthService.verifyAdminPermission('manage_settings');

    const body = await request.json();
    const parsed = RequestSchema.parse(body);

    const settings = await updateAppSettings(parsed);

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Admin updated application settings',
      {
        ...extractRequestMetadata(request),
        action: 'update_app_settings',
        resourceType: 'app_settings',
        updatedFields: Object.keys(parsed),
      },
      true
    );

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (error.message === 'Admin access required' || error.message.includes('permission required'))) {
      return NextResponse.json({ error: 'Forbidden: manage_settings permission required' }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }

    console.error('[AppSettingsAPI] Failed to save settings', error);
    return NextResponse.json(
      { error: 'Unable to save the application settings.' },
      { status: 500 },
    );
  }
}
