import { NextResponse, type NextRequest } from 'next/server';
import { AdminAuthService } from '@/lib/services/admin-auth-service';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveRequestOrigin } from '@/lib/server/resolve-request-origin';
import { i18n, type Locale } from '@/i18n/config';
import { logUserAction } from '@/lib/services/audit-log-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const DEFAULT_DASHBOARD_PATH = '/dashboard';

const isSupportedLocale = (candidate: string): candidate is Locale =>
  i18n.locales.includes(candidate as Locale);

const resolveLocalePath = (localeCandidate: string | null): Locale => {
  if (!localeCandidate) {
    return i18n.defaultLocale;
  }

  const normalized = localeCandidate.trim();
  return isSupportedLocale(normalized) ? normalized : i18n.defaultLocale;
};

const resolveRedirectPath = (
  candidate: string | null,
  locale: Locale,
): string => {
  if (candidate && candidate.startsWith('/')) {
    return candidate;
  }

  return `/${locale}${DEFAULT_DASHBOARD_PATH}`;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const { id: userId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: 'User identifier is required.' }, { status: 400 });
    }

    const adminUser = await AdminAuthService.verifyAdminPermission('manage_users');

    const supabaseAdmin = getAdminClient();

    const { data: userRecord, error: userLookupError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userLookupError) {
      console.error('[AdminImpersonateUser] Failed to load user', userLookupError);
      return NextResponse.json({ error: 'Unable to locate the requested user.' }, { status: 404 });
    }

    const targetEmail = userRecord?.user?.email;

    if (!targetEmail) {
      return NextResponse.json({ error: 'The selected user does not have a valid email address.' }, { status: 422 });
    }

    const searchParams = request.nextUrl.searchParams;
    const locale = resolveLocalePath(searchParams.get('lang'));
    const redirectPath = resolveRedirectPath(searchParams.get('redirect'), locale);

    const requestHeaders = request.headers;
    const origin = resolveRequestOrigin(requestHeaders);

    // Build the callback URL that will handle the auth code exchange
    // and then redirect to the final destination
    const callbackUrl = new URL('/api/auth/callback', origin);
    callbackUrl.searchParams.set('next', redirectPath);
    const redirectTo = callbackUrl.toString();

    console.log('[AdminImpersonateUser] Request headers:', {
      origin: requestHeaders.get('origin'),
      host: requestHeaders.get('host'),
      'x-forwarded-host': requestHeaders.get('x-forwarded-host'),
      'x-forwarded-proto': requestHeaders.get('x-forwarded-proto'),
    });
    console.log('[AdminImpersonateUser] Resolved origin:', origin);
    console.log('[AdminImpersonateUser] Redirect path:', redirectPath);
    console.log('[AdminImpersonateUser] Callback URL:', redirectTo);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      console.error('[AdminImpersonateUser] Failed to generate magic link', linkError);
      return NextResponse.json({ error: 'Unable to prepare the impersonation link.' }, { status: 500 });
    }

    const rawActionLink = linkData?.properties?.action_link;

    if (!rawActionLink) {
      return NextResponse.json({ error: 'Impersonation link was not provided by Supabase.' }, { status: 502 });
    }

    // ✅ FIX: Always use the request origin, never Supabase's hardcoded Site URL
    // Extract path from Supabase's link, rebuild with our origin and our redirect_to
    const supabaseLinkUrl = new URL(rawActionLink);
    
    // Always use our own redirect_to (Supabase may ignore or modify the one we pass)
    supabaseLinkUrl.searchParams.set('redirect_to', redirectTo);
    
    const actionLink = `${origin}${supabaseLinkUrl.pathname}?${supabaseLinkUrl.searchParams.toString()}`;

    console.log('[AdminImpersonateUser] Built magic link with request origin:', {
      supabaseOriginal: rawActionLink,
      requestOrigin: origin,
      finalLink: actionLink,
    });

    console.log('[AdminImpersonateUser] Generated magic link:', {
      actionLink,
      redirectTo,
      hasCode: actionLink.includes('code='),
      hasToken: actionLink.includes('token'),
    });

    await logUserAction('ADMIN_IMPERSONATE_USER', 'user', userId, {
      impersonatedUserEmail: targetEmail,
      impersonatedBy: adminUser.id,
      redirectTo,
    });

    // ✅ SECURITY: Audit log for user impersonation
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Admin impersonated user',
      {
        ...extractRequestMetadata(request),
        action: 'impersonate_user',
        resourceType: 'user',
        targetUserId: userId,
        targetUserEmail: targetEmail,
        adminId: adminUser.id,
        redirectTo,
      },
      true
    );

    return NextResponse.json({
      url: actionLink,
      redirectTo,
    });
  } catch (error) {
    console.error('[AdminImpersonateUser] Unexpected failure', error);
    return NextResponse.json({ error: 'Unexpected error while preparing impersonation.' }, { status: 500 });
  }
}
