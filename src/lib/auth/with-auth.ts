import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import { isAccountBlockedWithClient } from '@/lib/security/blocked-account-checker';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';

/**
 * Authentication middleware for API routes
 * Validates Supabase session, checks user blacklist, and provides authenticated user
 */

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

export type AuthenticatedHandler<_T = any> = (
  request: AuthenticatedRequest,
  context?: { params?: Promise<Record<string, string>> | Record<string, string> }
) => Promise<NextResponse<any>> | NextResponse<any>;

export interface WithAuthOptions {
  /**
   * Whether to require authentication (default: true)
   * If false, user will be null if not authenticated
   */
  required?: boolean;

  /**
   * Custom error message for unauthorized requests
   */
  unauthorizedMessage?: string;

  /**
   * Custom status code for unauthorized requests (default: 401)
   */
  unauthorizedStatus?: number;
}

/**
 * Wraps an API route handler with authentication
 * 
 * @example
 * ```typescript
 * export const GET = withAuth(async (request) => {
 *   const userId = request.user.id;
 *   // ... handle authenticated request
 *   return NextResponse.json({ data });
 * });
 * ```
 * 
 * @example With optional auth
 * ```typescript
 * export const GET = withAuth(async (request) => {
 *   const userId = request.user?.id; // May be undefined
 *   // ... handle request
 * }, { required: false });
 * ```
 */
export function withAuth<T = any>(
  handler: AuthenticatedHandler<T>,
  options: WithAuthOptions = {}
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  const {
    required = true,
    unauthorizedMessage = 'Unauthorized',
    unauthorizedStatus = 401,
  } = options;

  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error('[withAuth] Error getting user:', error);
      }

      if (error || !user) {
        if (required) {
          return NextResponse.json(
            { error: unauthorizedMessage, details: error?.message },
            { status: unauthorizedStatus }
          ) as NextResponse<T>;
        }
        // If not required, continue with null user
        (request as AuthenticatedRequest).user = null as any as User;
      } else {
        // Check if user account is blocked
        const blockedResult = await isAccountBlockedWithClient(user.id, supabase);

        if (blockedResult.isBlocked) {
          // Get IP for logging
          const forwarded = request.headers.get('x-forwarded-for');
          const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

          // Log the blocked access attempt
          await SecurityAuditLogger.log(
            (SecurityEventType as any).BLOCKED_USER_ACCESS_ATTEMPT,
            (SecurityEventSeverity as any).HIGH,
            `Blocked user attempted to access API: ${user.email}`,
            {
              userId: user.id,
              email: user.email,
              ipAddress: ip,
              requestPath: request.nextUrl.pathname,
              blockReason: blockedResult.reason,
              fraudType: blockedResult.fraudType,
              blockId: blockedResult.blockId,
            },
            false
          );

          // Sign out the user
          await supabase.auth.signOut();

          return NextResponse.json(
            { error: 'Account blocked', message: 'Your account has been blocked. Please contact support.' },
            { status: 403 }
          ) as NextResponse<T>;
        }

        // Attach user to request
        (request as AuthenticatedRequest).user = user;
      }

      return handler(request as AuthenticatedRequest, context);
    } catch (error) {
      console.error('[withAuth] Authentication error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      ) as NextResponse<T>;
    }
  };
}

/**
 * Extracts user from request headers (for backward compatibility)
 * @deprecated Use withAuth middleware instead
 */
export async function getUserFromRequest(_request: NextRequest): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('[getUserFromRequest] Error:', error);
    return null;
  }
}

/**
 * Validates that user has admin access (access_admin_panel permission)
 * Uses RBAC permission system instead of hardcoded role check
 */
export async function requireAdmin(user: User): Promise<boolean> {
  try {
    // Use RBAC permission system to check for access_admin_panel permission
    const { getUserPermissions } = await import('@/lib/services/permission-service');
    const userPermissions = await getUserPermissions(user.id);

    return userPermissions?.permissions.includes('access_admin_panel') || false;
  } catch (error) {
    console.error('[requireAdmin] Error:', error);
    return false;
  }
}

/**
 * Wraps an API route handler with admin authentication
 */
export function withAdminAuth<T = any>(
  handler: AuthenticatedHandler<T>
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  return withAuth(async (request, context) => {
    const isAdmin = await requireAdmin(request.user);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      ) as NextResponse<T>;
    }

    return handler(request, context);
  });
}

/**
 * Wraps an API route handler with admin authentication AND permission check
 *
 * @example
 * ```typescript
 * export const GET = withAdminPermission('manage_users', async (request) => {
 *   // User is authenticated, is admin, and has 'manage_users' permission
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withAdminPermission<T = any>(
  permission: string,
  handler: AuthenticatedHandler<T>
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  return withAuth(async (request, context) => {
    const isAdmin = await requireAdmin(request.user);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      ) as NextResponse<T>;
    }

    // Check permission
    const { getUserPermissions } = await import('@/lib/services/permission-service');
    const userPermissions = await getUserPermissions(request.user.id);

    if (!userPermissions || !userPermissions.permissions.includes(permission as any)) {
      return NextResponse.json(
        { error: `Forbidden: ${permission} permission required` },
        { status: 403 }
      ) as NextResponse<T>;
    }

    return handler(request, context);
  });
}

/**
 * Wraps an API route handler with admin authentication AND any of the specified permissions
 *
 * @example
 * ```typescript
 * export const GET = withAdminAnyPermission(['manage_users', 'view_dashboard'], async (request) => {
 *   // User has at least one of the specified permissions
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withAdminAnyPermission<T = any>(
  permissions: string[],
  handler: AuthenticatedHandler<T>
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<NextResponse<any>> {
  return withAuth(async (request, context) => {
    const isAdmin = await requireAdmin(request.user);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      ) as NextResponse<T>;
    }

    // Check permissions
    const { getUserPermissions } = await import('@/lib/services/permission-service');
    const userPermissions = await getUserPermissions(request.user.id);

    if (!userPermissions) {
      return NextResponse.json(
        { error: 'Forbidden: No permissions assigned' },
        { status: 403 }
      ) as NextResponse<T>;
    }

    const hasAny = permissions.some(p => userPermissions.permissions.includes(p as any));

    if (!hasAny) {
      return NextResponse.json(
        { error: `Forbidden: one of [${permissions.join(', ')}] required` },
        { status: 403 }
      ) as NextResponse<T>;
    }

    return handler(request, context);
  });
}

