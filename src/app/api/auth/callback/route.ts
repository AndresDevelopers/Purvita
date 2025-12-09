import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isAccountBlocked } from '@/lib/security/blocked-account-checker';

/**
 * 🔒 SECURITY: OAuth callback endpoint with open redirect protection
 *
 * GET /api/auth/callback?code=xxx&next=/path
 *
 * Handles OAuth authentication callbacks from Supabase Auth.
 *
 * Security measures:
 * - Validates 'next' parameter to prevent open redirects
 * - Only allows relative paths or same-origin URLs
 * - Logs authentication attempts for auditing
 */

/**
 * Validates redirect URL to prevent open redirect vulnerabilities
 * @param url - The URL to validate
 * @param origin - The origin of the request
 * @returns Safe redirect URL (relative path or same origin only)
 */
function getSafeRedirectUrl(url: string, origin: string): string {
  // Default safe redirect
  const defaultRedirect = '/';

  // If empty or just '/', return default
  if (!url || url === '/') {
    return defaultRedirect;
  }

  try {
    // If it's a relative path (starts with /), it's safe
    if (url.startsWith('/') && !url.startsWith('//')) {
      // Prevent protocol-relative URLs like //evil.com
      return url;
    }

    // If it's an absolute URL, verify it's the same origin
    const redirectUrl = new URL(url, origin);
    const requestOrigin = new URL(origin);

    if (redirectUrl.origin === requestOrigin.origin) {
      // Same origin, safe to use
      return redirectUrl.pathname + redirectUrl.search + redirectUrl.hash;
    }

    // Different origin - potential open redirect attack
    console.warn('[AuthCallback] Blocked redirect to different origin:', {
      attempted: redirectUrl.origin,
      expected: requestOrigin.origin,
    });

    return defaultRedirect;
  } catch (_error) {
    // Invalid URL format
    console.warn('[AuthCallback] Invalid redirect URL format:', url);
    return defaultRedirect;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next') || '/';

  // ✅ SECURITY: Validate redirect URL to prevent open redirect attacks
  const next = getSafeRedirectUrl(nextParam, requestUrl.origin);

  console.log('[AuthCallback] Processing auth callback', {
    code: code ? 'present' : 'missing',
    requestedNext: nextParam,
    safeNext: next,
    fullUrl: request.url,
  });

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[AuthCallback] Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/auth/error', requestUrl.origin));
    }

    console.log('[AuthCallback] Successfully authenticated user:', {
      email: data.user?.email,
      userId: data.user?.id,
      hasSession: !!data.session,
    });

    // ✅ SECURITY: Check if user account is blocked
    if (data.user?.id) {
      const blockStatus = await isAccountBlocked(data.user.id);
      if (blockStatus.isBlocked) {
        console.warn('[AuthCallback] Blocked user attempted login:', {
          userId: data.user.id,
          email: data.user.email,
          reason: blockStatus.reason,
          fraudType: blockStatus.fraudType,
        });

        // Sign out the user immediately
        await supabase.auth.signOut();

        // Redirect to blocked page with reason
        const blockedUrl = new URL('/auth/blocked', requestUrl.origin);
        blockedUrl.searchParams.set('reason', blockStatus.reason || 'Your account has been suspended');
        if (blockStatus.fraudType) {
          blockedUrl.searchParams.set('type', blockStatus.fraudType);
        }
        if (blockStatus.expiresAt) {
          blockedUrl.searchParams.set('expires', blockStatus.expiresAt);
        }

        const blockedResponse = NextResponse.redirect(blockedUrl);
        blockedResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return blockedResponse;
      }
    }

    // Create response with redirect
    const response = NextResponse.redirect(new URL(next, requestUrl.origin));

    // Add cache control headers to prevent caching of the redirect
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  }

  // Redirect to the next URL or dashboard
  const response = NextResponse.redirect(new URL(next, requestUrl.origin));
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return response;
}

