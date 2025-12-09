import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/utils/admin-route-helper';

/**
 * GET /api/admin/test
 * Test endpoint for admin authentication (DEVELOPMENT ONLY)
 * ✅ SECURITY: Blocked in production to prevent information disclosure
 * Requires admin authentication + secret token in development
 */
export const GET = withAdminAuth(async (request) => {
  try {
    // ✅ SECURITY: Block in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      );
    }

    // ✅ SECURITY: Require secret token even in development
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const validToken = process.env.ADMIN_TEST_TOKEN || 'dev-test-token';

    if (token !== validToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ SECURITY: Only return boolean flags, no sensitive data
    return NextResponse.json({
      message: 'API test successful',
      timestamp: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    });
  } catch (error) {
    // ✅ SECURITY: Don't expose error details
    console.error('[Admin Test] Error:', error);
    return NextResponse.json(
      { error: 'Test failed' },
      { status: 500 }
    );
  }
});