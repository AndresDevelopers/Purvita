import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { secretRotation } from '@/lib/security/secret-rotation';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';
import { SentryLogger } from '@/modules/observability/services/sentry-logger';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const requestSchema = z.object({
  secretName: z.string().optional(), // Optional: rotate specific secret
  rotateAll: z.boolean().optional().default(false), // Optional: rotate all needed secrets
});

/**
 * POST /api/admin/security/rotate-secrets
 * Rotate security secrets
 * Requires: manage_security permission
 */
export const POST = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { secretName, rotateAll } = requestSchema.parse(body);

    if (secretName) {
      // Rotate specific secret
      const result = await secretRotation.rotateSecret(secretName);

      if (result.success && result.rotated) {
        await SecurityAuditLogger.log(
          SecurityEventType.SECRET_ROTATION_COMPLETED,
          SecurityEventSeverity.INFO,
          `Admin manually rotated secret: ${secretName}`,
          {
            secretName,
            rotatedBy: request.user.id,
            rotationDate: new Date().toISOString()
          }
        );

        return NextResponse.json({
          success: true,
          message: result.message,
          rotated: true,
          secretName,
        });
      } else if (result.success && !result.rotated) {
        return NextResponse.json({
          success: true,
          message: result.message,
          rotated: false,
          secretName,
        });
      } else {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }

    } else if (rotateAll) {
      // Rotate all secrets that need rotation
      const results = await secretRotation.rotateAllNeededSecrets();

      const rotatedSecrets = results.filter(r => r.rotated);
      const skippedSecrets = results.filter(r => !r.rotated && r.success);
      const failedSecrets = results.filter(r => !r.success);

      if (rotatedSecrets.length > 0) {
        await SecurityAuditLogger.log(
          SecurityEventType.SECRET_ROTATION_COMPLETED,
          SecurityEventSeverity.INFO,
          `Admin manually rotated ${rotatedSecrets.length} secrets`,
          {
            rotatedSecrets: rotatedSecrets.map(r => r.message),
            rotatedBy: request.user.id,
            rotationDate: new Date().toISOString()
          }
        );
      }

      return NextResponse.json({
        success: true,
        rotated: rotatedSecrets.map(r => ({
          secretName: r.message.split(': ')[1],
          success: true
        })),
        skipped: skippedSecrets.map(r => ({
          secretName: r.message.split(': ')[1],
          reason: r.message
        })),
        failed: failedSecrets.map(r => ({
          secretName: r.message.split(': ')[1],
          error: r.message
        })),
        total: results.length
      });

    } else {
      return NextResponse.json(
        { error: 'Either secretName or rotateAll must be provided' },
        { status: 400 }
      );
    }

  } catch (error) {
    SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'admin',
      operation: 'rotate_secrets',
      tags: { error_type: 'secret_rotation_error' },
    });

    await SecurityAuditLogger.log(
      SecurityEventType.SECRET_ROTATION_FAILED,
      SecurityEventSeverity.ERROR,
      'Secret rotation API error',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: request.nextUrl.pathname
      },
      false
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/admin/security/rotate-secrets
 * Get secret rotation status
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    const status = secretRotation.getRotationStatus();

    return NextResponse.json({
      success: true,
      secrets: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'admin',
      operation: 'get_secret_status',
      tags: { error_type: 'internal_error' },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});