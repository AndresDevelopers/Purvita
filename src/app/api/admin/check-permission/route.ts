import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/with-auth';
import { getUserPermissions } from '@/lib/services/permission-service';
import type { Permission } from '@/lib/models/role';
import { z } from 'zod';

const CheckPermissionSchema = z.object({
  permission: z.string(),
});

/**
 * POST /api/admin/check-permission
 * Check if the current admin user has a specific permission
 * Used by AdminGuard component for client-side permission checks
 *
 * NOTE: CSRF protection is NOT required here because:
 * - This is a read-only operation (checking permissions, not modifying data)
 * - Already protected by withAdminAuth (requires authentication + admin role)
 * - Used by client-side guards that don't have CSRF tokens available
 */
export const POST = withAdminAuth(async (request) => {

  try {
    const body = await request.json();
    const { permission } = CheckPermissionSchema.parse(body);

    // Get user permissions
    const userPermissions = await getUserPermissions(request.user.id);

    if (!userPermissions) {
      return NextResponse.json(
        { error: 'User permissions not found' },
        { status: 404 }
      );
    }

    // Check if user has the required permission
    const hasPermission = userPermissions.permissions.includes(permission as Permission);

    if (!hasPermission) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: `User does not have required permission: ${permission}`,
          hasPermission: false
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      hasPermission: true,
      permission,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error checking permission:', error);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

