/**
 * Authorization Middleware
 * 
 * Standard middleware for protecting API routes with permission checks.
 * This is the CORE authorization system for API routes.
 * 
 * @example
 * ```typescript
 * // Protect with single permission
 * export const GET = withPermission('manage_users', async (request) => {
 *   return NextResponse.json({ data });
 * });
 * 
 * // Protect with any of multiple permissions
 * export const POST = withAnyPermission(['manage_users', 'view_users'], async (request) => {
 *   return NextResponse.json({ data });
 * });
 * 
 * // Basic authentication only (no specific permission)
 * export const GET = withAuth(async (request) => {
 *   return NextResponse.json({ user: request.user });
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getAuthorizationContext, AuthorizationError } from '../services/authorization-service';
import type { Permission } from '../models/permission';
import type { AuthorizationContext } from '../models/role';

/**
 * Extended request with user and authorization context
 */
export interface AuthorizedRequest extends NextRequest {
  user: User;
  authorization: AuthorizationContext;
}

/**
 * Handler function type for authorized routes
 */
export type AuthorizedHandler<_T = any> = (
  request: AuthorizedRequest,
  context?: { params?: Promise<Record<string, string>> | Record<string, string> }
) => Promise<NextResponse<any>> | NextResponse<any>;

/**
 * Get authenticated user from request
 */
async function getAuthenticatedUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('[getAuthenticatedUser] Error:', error);
    return null;
  }
}

/**
 * Base middleware that requires authentication
 */
export function withAuth<T = unknown>(
  handler: AuthorizedHandler<T>
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  return async (request: NextRequest, context) => {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get authorization context
    const authContext = await getAuthorizationContext(user.id);

    // Extend request with user and authorization
    const authorizedRequest = request as AuthorizedRequest;
    authorizedRequest.user = user;
    authorizedRequest.authorization = authContext || {
      userId: user.id,
      roleId: null,
      roleName: null,
      permissions: [],
    };

    return handler(authorizedRequest, context);
  };
}

/**
 * Middleware that requires a specific permission
 */
export function withPermission<T = unknown>(
  permission: Permission,
  handler: AuthorizedHandler<T>
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  return withAuth(async (request, context) => {
    if (!request.authorization.permissions.includes(permission)) {
      return NextResponse.json(
        { error: `Forbidden: ${permission} permission required` },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

/**
 * Middleware that requires ANY of the specified permissions
 */
export function withAnyPermission<T = unknown>(
  permissions: Permission[],
  handler: AuthorizedHandler<T>
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  return withAuth(async (request, context) => {
    const hasAny = permissions.some(p => request.authorization.permissions.includes(p));

    if (!hasAny) {
      return NextResponse.json(
        { error: `Forbidden: one of [${permissions.join(', ')}] required` },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

/**
 * Middleware that requires ALL of the specified permissions
 */
export function withAllPermissions<T = unknown>(
  permissions: Permission[],
  handler: AuthorizedHandler<T>
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  return withAuth(async (request, context) => {
    const hasAll = permissions.every(p => request.authorization.permissions.includes(p));

    if (!hasAll) {
      return NextResponse.json(
        { error: `Forbidden: all of [${permissions.join(', ')}] required` },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

/**
 * Helper to check permission in handler
 */
export function checkPermission(request: AuthorizedRequest, permission: Permission): boolean {
  return request.authorization.permissions.includes(permission);
}

/**
 * Helper to require permission in handler (throws if not present)
 */
export function ensurePermission(request: AuthorizedRequest, permission: Permission): void {
  if (!request.authorization.permissions.includes(permission)) {
    throw new AuthorizationError(
      `Permission denied: ${permission} required`,
      'PERMISSION_DENIED',
      permission
    );
  }
}
