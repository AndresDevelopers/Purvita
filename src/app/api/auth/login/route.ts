import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RateLimitPresets as _RateLimitPresets } from '@/lib/utils/rate-limit';
import { z } from 'zod';
import { isAccountBlockedWithClient } from '@/lib/security/blocked-account-checker';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';
import { validateCaptcha } from '@/lib/security/captcha-validator';
import { getRateLimitConfig } from '@/lib/helpers/rate-limit-config-helper';
import { shouldBypassCaptcha, shouldBypassRateLimiting } from '@/lib/security/trusted-agent-helpers';

/**
 * POST /api/auth/login
 *
 * Login endpoint with configurable rate limiting protection and blacklist verification.
 *
 * Rate limit configured via environment variables:
 * - LOGIN_RATE_LIMIT_ATTEMPTS: Maximum attempts (default: 5)
 * - LOGIN_RATE_LIMIT_WINDOW_SECONDS: Time window in seconds (default: 60)
 *
 * Security features:
 * - Rate limiting by IP address
 * - CAPTCHA verification (if enabled in admin settings)
 * - User blacklist verification
 * - Security audit logging
 *
 * After exceeding the limit, the user must wait before trying again.
 *
 * Note: CSRF protection is NOT required for login endpoint as:
 * - Login is for unauthenticated users (no existing session to protect)
 * - Already protected by rate limiting, CAPTCHA, and honeypot
 * - CSRF is for protecting authenticated users from unwanted actions
 */

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().nullable().optional(),
  // Honeypot field - should always be empty
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  // Get IP address for logging and rate limiting
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';

  // Check if this is a trusted agent that can bypass rate limiting
  const bypassRateLimit = shouldBypassRateLimiting(req);

  if (!bypassRateLimit) {
    // Get rate limit configuration from database (with fallback to environment variables)
    const config = await getRateLimitConfig();
    const maxAttempts = config.loginRateLimitAttempts;
    const windowSeconds = config.loginRateLimitWindowSeconds;

    // Apply rate limiting based on IP address
    const rateLimitResult = await rateLimit(ip, {
      limit: maxAttempts,
      window: windowSeconds,
      prefix: 'auth:login',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many login attempts',
          message: 'You have exceeded the maximum number of login attempts. Please try again later.',
          retryAfter: rateLimitResult.reset,
          remainingAttempts: 0,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': (rateLimitResult.reset - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }
  }

  try {
    // Validate request body
    const body = await req.json();
    const validatedData = LoginSchema.parse(body);

    // Honeypot check - if 'website' field is filled, it's a bot
    if (validatedData.website && validatedData.website.length > 0) {
      // ✅ SECURITY: Log honeypot activation
      await SecurityAuditLogger.log(
        SecurityEventType.FRAUD_DETECTED,
        SecurityEventSeverity.CRITICAL,
        'Honeypot field filled in login form',
        {
          ipAddress: ip,
          userEmail: validatedData.email,
          action: 'honeypot_triggered',
          resourceType: 'login_form'
        },
        false
      );

      return NextResponse.json(
        {
          error: 'Login failed',
          message: 'Invalid request',
        },
        { status: 400 }
      );
    }

    // Verify CAPTCHA if enabled (skip for trusted agents)
    const bypassCaptcha = shouldBypassCaptcha(req);
    if (!bypassCaptcha) {
      const captchaResult = await validateCaptcha(validatedData.captchaToken);
      if (!captchaResult.success) {
        // ✅ SECURITY: Log CAPTCHA failure
        await SecurityAuditLogger.log(
          SecurityEventType.CSRF_TOKEN_VALIDATION_FAILED,
          SecurityEventSeverity.WARNING,
          'CAPTCHA verification failed on login',
          {
            ipAddress: ip,
            userEmail: validatedData.email,
            action: 'captcha_failed',
            reason: captchaResult.error || 'Unknown error'
          },
          false
        );

        return NextResponse.json(
          {
            error: 'CAPTCHA verification failed',
            message: captchaResult.error || 'Please complete the CAPTCHA verification',
          },
          { status: 400 }
        );
      }
    }

    // Create Supabase client
    const supabase = await createClient();

    // Attempt login
    const {
      data: { session },
      error,
    } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      // Sanitize error messages in production
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Invalid email or password'
        : error.message;

      return NextResponse.json(
        {
          error: 'Authentication failed',
          message: errorMessage,
        },
        { status: 401 }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          error: 'Authentication failed',
          message: 'No session created',
        },
        { status: 401 }
      );
    }

    // Check if user account is blocked
    const blockedResult = await isAccountBlockedWithClient(session.user.id, supabase);

    if (blockedResult.isBlocked) {
      // Log the blocked login attempt
      await SecurityAuditLogger.log(
        (SecurityEventType as any).BLOCKED_USER_LOGIN_ATTEMPT,
        (SecurityEventSeverity as any).HIGH,
        `Blocked user attempted to login: ${validatedData.email}`,
        {
          userId: session.user.id,
          email: validatedData.email,
          ipAddress: ip,
          blockReason: blockedResult.reason,
          fraudType: blockedResult.fraudType,
          blockId: blockedResult.blockId,
        },
        false
      );

      // Sign out the user immediately
      await supabase.auth.signOut();

      return NextResponse.json(
        {
          error: 'Account blocked',
          message: blockedResult.reason || 'Your account has been suspended.',
          blocked: true,
          blockDetails: {
            reason: blockedResult.reason,
            fraudType: blockedResult.fraudType,
            expiresAt: blockedResult.expiresAt,
          },
        },
        { status: 403 }
      );
    }

    // Check if MFA is required for this user
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaRequired = mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2';
    
    // Get the MFA factor ID if MFA is required
    let mfaFactorId: string | null = null;
    if (mfaRequired) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factorsData?.totp?.find(f => f.status === 'verified');
      mfaFactorId = verifiedFactor?.id ?? null;
    }

    // Return success with user data only
    // ✅ SECURITY: Tokens are stored in HTTP-only cookies by Supabase, not exposed in response body
    return NextResponse.json(
      {
        success: true,
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        mfaRequired,
        mfaFactorId,
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: error.errors[0].message,
        },
        { status: 400 }
      );
    }

    // Log error only in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Login error:', error);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
