import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { getRoleById, updateRole, deleteRole } from '@/lib/services/role-service';
import { UpdateRoleSchema } from '@/lib/models/role';
import { ZodError } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { logAdminRead, logAdminUpdate, logAdminDelete } from '@/lib/security/admin-audit-logger';
import { ErrorMessages, logAndGetGenericError } from '@/lib/utils/error-messages';

/**
 * GET /api/admin/roles/[id]
 * Get a single role by ID
 * Requires: manage_roles permission
 */
export const GET = withAdminPermission('manage_roles', async (request, context) => {
  try {
    const params = await context?.params;
    const id = params?.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    const role = await getRoleById(id);

    if (!role) {
      return NextResponse.json(
        { error: ErrorMessages.NOT_FOUND },
        { status: 404 }
      );
    }

    // ✅ AUDIT: Log role read
    await logAdminRead('role', request.user, {
      roleId: id,
      roleName: role.name,
    });

    return NextResponse.json(role);
  } catch (error) {
    const { message, statusCode } = logAndGetGenericError(error, 'GET /api/admin/roles/[id]');
    return NextResponse.json(
      { error: message },
      { status: statusCode }
    );
  }
});

/**
 * PUT /api/admin/roles/[id]
 * Update a role
 * Requires: manage_roles permission
 */
export const PUT = withAdminPermission('manage_roles', async (request, context) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const params = await context?.params;
    const id = params?.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = UpdateRoleSchema.parse(body);

    // Update role
    const updatedRole = await updateRole(id, validatedData);

    // ✅ AUDIT: Log role update
    await logAdminUpdate('role', request.user, {
      roleId: id,
      roleName: updatedRole.name,
      changes: validatedData,
    });

    return NextResponse.json(updatedRole);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: ErrorMessages.VALIDATION_ERROR,
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }))
        },
        { status: 400 }
      );
    }

    const { message, statusCode } = logAndGetGenericError(error, 'PUT /api/admin/roles/[id]');
    return NextResponse.json(
      { error: message },
      { status: statusCode }
    );
  }
});

/**
 * DELETE /api/admin/roles/[id]
 * Delete a role
 * Requires: manage_roles permission
 */
export const DELETE = withAdminPermission('manage_roles', async (request, context) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const params = await context?.params;
    const id = params?.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    await deleteRole(id);

    // ✅ AUDIT: Log role deletion (CRITICAL)
    await logAdminDelete('role', request.user, {
      roleId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, statusCode } = logAndGetGenericError(error, 'DELETE /api/admin/roles/[id]');
    return NextResponse.json(
      { error: message },
      { status: statusCode }
    );
  }
});

