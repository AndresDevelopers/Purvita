import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { getAllRoles, createRole } from '@/lib/services/role-service';
import { CreateRoleSchema } from '@/lib/models/role';
import { ZodError } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { logAdminRead, logAdminCreate } from '@/lib/security/admin-audit-logger';

/**
 * GET /api/admin/roles
 * Get all roles with user counts
 * Requires: manage_roles permission
 */
export const GET = withAdminPermission('manage_roles', async (request) => {
  try {
    const roles = await getAllRoles();

    // ✅ AUDIT: Log roles list access
    await logAdminRead('roles_list', request.user, {
      count: roles.length,
    });

    return NextResponse.json(roles);
  } catch (error) {
    // ✅ SECURITY: Log error internally but don't expose details to client
    console.error('[Admin Roles] Error fetching roles:', error);

    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/roles
 * Create a new role
 * Requires: manage_roles permission
 */
export const POST = withAdminPermission('manage_roles', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();

    // Validate input
    const validatedData = CreateRoleSchema.parse(body);

    // Create role
    const newRole = await createRole(validatedData);

    // ✅ AUDIT: Log role creation
    await logAdminCreate('role', request.user, {
      roleId: newRole.id,
      roleName: newRole.name,
      permissions: newRole.permissions,
    });

    return NextResponse.json(newRole, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error in POST /api/admin/roles:', error);
    }
    
    if (error instanceof ZodError) {
      // ✅ SECURITY: Sanitize Zod error messages to prevent information disclosure
      const sanitizedErrors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return NextResponse.json(
        {
          error: 'Validation error',
          details: sanitizedErrors
        },
        { status: 400 }
      );
    }
    
    // ✅ SECURITY: Log error internally but provide generic message to client
    console.error('[Admin Roles] Error creating role:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create role';
    const statusCode = errorMessage.includes('already exists') ? 409 : 500;
    const clientMessage = errorMessage.includes('already exists')
      ? 'Role already exists'
      : 'Failed to create role';

    return NextResponse.json(
      { error: clientMessage },
      { status: statusCode }
    );
  }
});

