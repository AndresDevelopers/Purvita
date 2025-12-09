import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getServiceRoleClient } from '@/lib/supabase';
import {
  getContactSettingsWithStatus,
  updateContactSettings,
} from '@/modules/contact/services/contact-service';
import { ContactSettingsUpdateSchema } from '@/modules/contact/domain/models/contact-settings';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * GET /api/admin/contact-settings
 * Get contact settings
 * Requires: manage_settings permission
 */
export const GET = withAdminPermission('manage_settings', async () => {
  try {
    const response = await getContactSettingsWithStatus();
    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Failed to load contact settings', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});

/**
 * PUT /api/admin/contact-settings
 * Update contact settings
 * Requires: manage_settings permission
 */
export const PUT = withAdminPermission('manage_settings', async (request) => {
  // Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  if (!getServiceRoleClient()) {
    return NextResponse.json(
      { error: 'Service role credentials not configured' },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const payload = ContactSettingsUpdateSchema.parse(body);
    const response = await updateContactSettings(payload);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated contact settings',
      {
        ...extractRequestMetadata(request),
        action: 'update_contact_settings',
        resourceType: 'contact_settings',
        fromEmail: payload.fromEmail,
        autoResponseEnabled: payload.autoResponseEnabled,
      },
      true
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Failed to update contact settings', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});
