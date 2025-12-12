import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { UploadLimitsService } from '@/modules/upload/services/upload-limits-service';
import { UploadLimitsUpdateSchema } from '@/modules/upload/domain/models/upload-limits';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';
import { withAdminPermission } from '@/lib/auth/with-auth';

/**
 * GET /api/admin/upload-limits
 * Get current upload limits configuration
 * Requires: manage_settings permission
 */
export const GET = withAdminPermission('manage_settings', async () => {
  try {
    const supabase = await createClient();
    const service = new UploadLimitsService(supabase);
    const config = await service.getConfig();

    if (!config) {
      return NextResponse.json(
        { error: 'Upload limits configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[API] Failed to fetch upload limits:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch upload limits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

/**
 * PUT /api/admin/upload-limits
 * Update upload limits configuration
 * Requires: manage_settings permission + CSRF token
 */
export const PUT = withAdminPermission('manage_settings', async (req: NextRequest) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  try {
    // Use regular client to get user info
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // ✅ SECURITY: Validate request body with Zod
    const validation = UploadLimitsUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS for write operations
    // Permission check is already done by withAdminPermission middleware
    const adminSupabase = createAdminClient();
    const service = new UploadLimitsService(adminSupabase);
    const config = await service.updateConfig(validation.data, user.id);

    // ✅ SECURITY: Audit log for config changes
    await SecurityAuditLogger.log(
      SecurityEventType.SECURITY_SETTING_CHANGED,
      SecurityEventSeverity.WARNING,
      'Admin updated upload limits configuration',
      {
        adminId: user.id,
        changes: validation.data,
      },
      false
    );

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[API] Failed to update upload limits:', error);
    const message = error instanceof Error ? error.message : 'Failed to update upload limits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

/**
 * POST /api/admin/upload-limits/reset
 * Reset upload limits to defaults
 * Requires: manage_settings permission + CSRF token
 */
export const POST = withAdminPermission('manage_settings', async (req: NextRequest) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  try {
    // Use regular client to get user info
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS for write operations
    // Permission check is already done by withAdminPermission middleware
    const adminSupabase = createAdminClient();
    const service = new UploadLimitsService(adminSupabase);
    const config = await service.resetToDefaults(user.id);

    // ✅ SECURITY: Audit log for reset
    await SecurityAuditLogger.log(
      SecurityEventType.SECURITY_SETTING_CHANGED,
      SecurityEventSeverity.WARNING,
      'Admin reset upload limits to defaults',
      {
        adminId: user.id,
      },
      false
    );

    return NextResponse.json({ config, message: 'Upload limits reset to defaults' });
  } catch (error) {
    console.error('[API] Failed to reset upload limits:', error);
    const message = error instanceof Error ? error.message : 'Failed to reset upload limits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
