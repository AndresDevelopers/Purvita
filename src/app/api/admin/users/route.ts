import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUsers } from '@/lib/services/user-service';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { sanitizeInput } from '@/lib/security/input-sanitization';
import { SentryLogger } from '@/modules/observability/services/sentry-logger';
import { z } from 'zod';

// ✅ SECURITY: Validate search query parameters with strict schema
const SearchQuerySchema = z.object({
  email: z.string().max(255).regex(/^[a-zA-Z0-9@._\-\s]*$/).optional(),
  query: z.string().max(100).regex(/^[a-zA-Z0-9\s\-_@.]*$/).optional(),
});

/**
 * GET /api/admin/users
 * Get all users
 * Requires: manage_users permission
 */
export const GET = withAdminPermission('manage_users', async (request: NextRequest) => {
  try {
    const users = await getUsers();

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const rawEmailQuery = searchParams.get('email');
    const rawGeneralQuery = searchParams.get('query');

    // ✅ SECURITY: Validate and sanitize query parameters
    const validationResult = SearchQuerySchema.safeParse({
      email: rawEmailQuery,
      query: rawGeneralQuery,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters' },
        { status: 400 }
      );
    }

    const emailQuery = validationResult.data.email ? sanitizeInput(validationResult.data.email) : null;
    const generalQuery = validationResult.data.query ? sanitizeInput(validationResult.data.query) : null;

    // Filter users by email or general query if parameter is provided
    let filteredUsers = users;

    // Priority to general query parameter (more flexible)
    if (generalQuery && generalQuery.trim()) {
      const query = generalQuery.trim().toLowerCase();
      filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(query) ||
        user.name.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
      );
    } else if (emailQuery && emailQuery.trim()) {
      // Fallback to email query for backward compatibility
      const query = emailQuery.trim().toLowerCase();
      filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(query) ||
        user.name.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ users: filteredUsers });
  } catch (error) {
    // ✅ SECURITY: Log error internally but don't expose details to client
    console.error('[Admin Users] Error fetching users:', error);
    SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'admin',
      operation: 'get_users',
      tags: { error_type: 'internal_error' },
    });
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
});