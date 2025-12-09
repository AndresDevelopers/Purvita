import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { getUserPermissions } from '@/lib/services/permission-service';

/**
 * GET /api/check-admin-access
 * Check if the current user has access_admin_panel permission
 * Used by UserMenu component to show/hide admin link
 *
 * This endpoint uses withAuth (not withAdminAuth) to avoid circular dependency:
 * - We need to check if user has access_admin_panel permission
 * - But withAdminAuth requires Super Admin role first
 * - So we use withAuth and check the permission directly
 */
export const GET = withAuth(async (request) => {
  try {
    const userPermissions = await getUserPermissions(request.user.id);

    if (!userPermissions) {
      return NextResponse.json(
        { hasAccess: false, permissions: [] },
        { status: 200 }
      );
    }

    const hasAccess = userPermissions.permissions.includes('access_admin_panel');

    return NextResponse.json({
      hasAccess,
      permissions: userPermissions.permissions,
    });
  } catch (error) {
    console.error('[check-admin-access] Error checking admin access:', error);

    return NextResponse.json(
      { hasAccess: false, permissions: [] },
      { status: 200 }
    );
  }
});
