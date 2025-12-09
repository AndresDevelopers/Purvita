/**
 * API Routes for Individual Role Management
 * 
 * GET /api/authorization/roles/[id] - Get role by ID
 * PUT /api/authorization/roles/[id] - Update role
 * DELETE /api/authorization/roles/[id] - Delete role
 * 
 * These are CORE system routes, protected by manage_roles permission.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withPermission } from '@/lib/authorization/middleware/with-permission';
import { getRoleById, updateRole, deleteRole } from '@/lib/authorization/services/role-management-service';
import { UpdateRoleSchema } from '@/lib/authorization/models/role';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { logAdminRead, logAdminUpdate, logAdminDelete } from '@/lib/security/admin-audit-logger';

/**
 * GET /api/authorization/roles/[id]
 * Get a single role by ID
 * Requires: manage_roles permission
 */
export const GET = withPermission('manage_roles', async (request, context) => {
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
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Audit log
    await logAdminRead('role', request.user, {
      roleId: id,
      roleName: role.name,
    });

    return NextResponse.json(role);
  } catch (error) {
    console.error('[GET /api/authorization/roles/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch role' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/authorization/roles/[id]
 * Update a role
 * Requires: manage_roles permission
 */
export const PUT = withPermission('manage_roles', async (request, context) => {
  // Validate CSRF token
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

    // Audit log
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
          error: 'Validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }))
        },
        { status: 400 }
      );
    }

    console.error('[PUT /api/authorization/roles/[id]] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update role';
    const isNotFound = errorMessage.includes('not found');
    const isSystemRole = errorMessage.includes('system roles');

    return NextResponse.json(
      { error: isNotFound ? 'Role not found' : isSystemRole ? 'Cannot modify system roles' : 'Failed to update role' },
      { status: isNotFound ? 404 : isSystemRole ? 403 : 500 }
    );
  }
});

/**
 * DELETE /api/authorization/roles/[id]
 * Delete a role
 * Requires: manage_roles permission
 */
export const DELETE = withPermission('manage_roles', async (request, context) => {
  // Validate CSRF token
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

    // Audit log (critical operation)
    await logAdminDelete('role', request.user, {
      roleId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/authorization/roles/[id]] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete role';
    const isNotFound = errorMessage.includes('not found');
    const isSystemRole = errorMessage.includes('system roles');
    const hasUsers = errorMessage.includes('assigned users');

    let status = 500;
    let message = 'Failed to delete role';

    if (isNotFound) {
      status = 404;
      message = 'Role not found';
    } else if (isSystemRole) {
      status = 403;
      message = 'Cannot delete system roles';
    } else if (hasUsers) {
      status = 409;
      message = 'Cannot delete role with assigned users';
    }

    return NextResponse.json({ error: message }, { status });
  }
});
