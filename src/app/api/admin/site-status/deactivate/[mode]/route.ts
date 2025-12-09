import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { deactivateSiteMode } from '@/modules/site-status/services/site-mode-service';
import { SiteModeTypeSchema } from '@/modules/site-status/domain/models/site-mode';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';
import { withAdminPermission } from '@/lib/auth/with-auth';


export const POST = withAdminPermission(
  'manage_settings',
  async (request: Request, { params }: { params: Promise<{ mode: string }> }) => {
    // ✅ SECURITY: Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    try {
      const { mode } = await params;
      const validatedMode = SiteModeTypeSchema.parse(mode);

      const configuration = await deactivateSiteMode(validatedMode);

      // Audit log
      await SecurityAuditLogger.log(
        SecurityEventType.ADMIN_ACTION,
        SecurityEventSeverity.CRITICAL,
        `Admin deactivated site mode: ${validatedMode}`,
        {
          ...extractRequestMetadata(request),
          action: 'deactivate_site_mode',
          resourceType: 'site_configuration',
          siteMode: validatedMode,
        },
        true,
      );

      return NextResponse.json(configuration);
    } catch (error) {
      console.error('[API] Failed to deactivate site mode', error);

      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid mode parameter',
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
  },
);