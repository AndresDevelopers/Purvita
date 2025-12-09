/**
 * Admin Route Helper
 *
 * Provides utilities for securing admin routes and handling common admin operations.
 */

import { NextResponse } from 'next/server';
import { AdminAuthService } from '@/lib/services/admin-auth-service';

/**
 * Wraps an admin route handler with automatic auth verification.
 *
 * NOTE: This is a thin re-export of the canonical `withAdminAuth`
 * from `@/lib/auth/with-auth`, so all admin routes share the same
 * authentication, blocked-account checks, and RBAC logic.
 *
 * You can keep importing from `@/lib/utils/admin-route-helper` for
 * backwards compatibility.
 */
export { withAdminAuth } from '@/lib/auth/with-auth';

/**
 * Verifies admin access and returns appropriate error response if unauthorized
 * Use this when you need more control over the handler flow
 *
 * @example
 * ```typescript
 * export async function GET() {
 *   const authError = await verifyAdminAccess();
 *   if (authError) return authError;
 *
 *   // Continue with your handler logic
 * }
 * ```
 */
export async function verifyAdminAccess(): Promise<NextResponse | null> {
  try {
    await AdminAuthService.verifyAdminAccess();
    return null;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Admin access required') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    // Unknown error
    return NextResponse.json(
      { error: 'Authentication verification failed' },
      { status: 500 }
    );
  }
}
