import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/auth/logout
 * Logs out the current user by clearing all Supabase auth cookies
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    const cookieStore = await cookies();

    // Clear all Supabase auth cookies
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'sb-provider-token',
    ];

    cookiesToClear.forEach((cookieName) => {
      cookieStore.delete(cookieName);
    });

    // Also clear any cookies that match Supabase patterns
    const allCookies = cookieStore.getAll();
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
        cookieStore.delete(cookie.name);
      }
    });

    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Logout] Error clearing cookies:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

/**
 * ✅ SECURITY FIX: GET method removed to prevent CSRF attacks
 *
 * IMPORTANT: Logout MUST only be performed via POST with CSRF token validation.
 * Supporting GET logout creates a critical security vulnerability where attackers can
 * force users to logout by including malicious links in emails or websites:
 *
 * Example attack: <img src="https://site.com/api/auth/logout">
 *
 * This forces any logged-in user who views the page to be logged out without consent.
 *
 * Proper logout flow:
 * 1. User clicks logout button/link
 * 2. Frontend sends POST request with CSRF token
 * 3. Server validates CSRF token
 * 4. Server clears cookies
 * 5. Frontend redirects to login page
 *
 * If you need logout via URL (e.g., for email links), implement a secure token system:
 * - Generate a cryptographically secure one-time token
 * - Include token as query parameter
 * - Validate token on server (single-use, time-limited)
 * - Clear token after use
 */
