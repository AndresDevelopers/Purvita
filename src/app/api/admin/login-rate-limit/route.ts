import { NextResponse } from 'next/server';
import { isAdminRateLimited } from '@/lib/security/admin-rate-limiter';

/**
 * POST /api/admin/login-rate-limit
 * Check if IP is rate limited for admin login attempts
 * Returns { limited: boolean, retryAfter?: number }
 */
export async function POST(request: Request) {
  try {
    // Get IP address from request
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    if (ip === 'unknown') {
      return NextResponse.json(
        { error: 'Unable to determine IP address' },
        { status: 400 }
      );
    }

    // Check if rate limited (3 attempts per 5 minutes for login)
    const isLimited = await isAdminRateLimited(ip, 'login');

    if (isLimited) {
      return NextResponse.json({
        limited: true,
        retryAfter: 300, // 5 minutes in seconds
      });
    }

    return NextResponse.json({
      limited: false,
    });
  } catch (error) {
    console.error('[Admin Login Rate Limit] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check rate limit' },
      { status: 500 }
    );
  }
}

