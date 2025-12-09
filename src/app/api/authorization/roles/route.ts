/**
 * API Routes for Role Management
 * 
 * GET /api/authorization/roles - List all roles
 * POST /api/authorization/roles - Create a new role
 * 
 * These are CORE system routes, protected by manage_roles permission.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withPermission } from '@/lib/authorization/middleware/with-permission';
import { getAllRoles, createRole } from '@/lib/authorization/services/role-management-service';
import { CreateRoleSchema } from '@/lib/authorization/models/role';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { logAdminRead, logAdminCreate } from '@/lib/security/admin-audit-logger';

/**
 * GET /api/authorization/roles
 * Get all roles with user counts
 * Requires: manage_roles permission
 */
export const GET = withPermission('manage_roles', async (request) => {
  try {
    const roles = await getAllRoles();

    // Audit log
    await logAdminRead('roles_list', request.user, {
      count: roles.length,
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error('[GET /api/authorization/roles] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/authorization/roles
 * Create a new role
 * Requires: manage_roles permission
 */
export const POST = withPermission('manage_roles', async (request) => {
  // Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();

    // Validate input
    const validatedData = CreateRoleSchema.parse(body);

    // Create role
    const newRole = await createRole(validatedData);

    // Audit log
    await logAdminCreate('role', request.user, {
      roleId: newRole.id,
      roleName: newRole.name,
      permissions: newRole.permissions,
    });

    return NextResponse.json(newRole, { status: 201 });
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

    console.error('[POST /api/authorization/roles] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create role';
    const statusCode = errorMessage.includes('already exists') ? 409 : 500;

    return NextResponse.json(
      { error: errorMessage.includes('already exists') ? 'Role already exists' : 'Failed to create role' },
      { status: statusCode }
    );
  }
});
