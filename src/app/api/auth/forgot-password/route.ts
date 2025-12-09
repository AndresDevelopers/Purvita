import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { validateCaptcha } from '@/lib/security/captcha-validator';
import { rateLimit } from '@/lib/utils/rate-limit';
import { shouldBypassCaptcha, shouldBypassRateLimiting } from '@/lib/security/trusted-agent-helpers';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';

/**
 * POST /api/auth/forgot-password
 *
 * Sends password reset email with CAPTCHA protection and rate limiting
 * to prevent email enumeration attacks and spam.
 *
 * Security features:
 * - Rate limiting (3 attempts per 15 minutes)
 * - CAPTCHA verification
 * - Returns same response for existing/non-existing emails (prevents enumeration)
 * - Audit logging
 */

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  captchaToken: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';

  // Check if this is a trusted agent
  const bypassRateLimit = shouldBypassRateLimiting(req);
  const bypassCaptcha = shouldBypassCaptcha(req);

  // Apply rate limiting: 3 attempts per 15 minutes
  if (!bypassRateLimit) {
    const rateLimitResult = await rateLimit(ip, {
      limit: 3,
      window: 900, // 15 minutes
      prefix: 'auth:forgot-password',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'You have exceeded the maximum number of password reset attempts. Please try again later.',
          retryAfter: rateLimitResult.reset,
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
    const body = await req.json();
    const validatedData = ForgotPasswordSchema.parse(body);

    // Verify CAPTCHA if enabled
    if (!bypassCaptcha) {
      const captchaResult = await validateCaptcha(validatedData.captchaToken);
      if (!captchaResult.success) {
        await SecurityAuditLogger.log(
          SecurityEventType.CSRF_TOKEN_VALIDATION_FAILED,
          SecurityEventSeverity.WARNING,
          'CAPTCHA verification failed on forgot password',
          {
            ipAddress: ip,
            userEmail: validatedData.email,
            action: 'captcha_failed',
            reason: captchaResult.error || 'Unknown error',
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

    // Send password reset email
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    // Log the attempt
    await SecurityAuditLogger.log(
      SecurityEventType.PASSWORD_RESET_REQUEST,
      SecurityEventSeverity.INFO,
      'Password reset requested',
      {
        ipAddress: ip,
        userEmail: validatedData.email,
        action: 'forgot_password',
        success: !error,
      },
      false
    );

    // ✅ SECURITY: Always return success to prevent email enumeration
    // Even if the email doesn't exist, we return the same response
    if (error) {
      console.warn('[Forgot Password] Email may not exist:', validatedData.email);
    }

    return NextResponse.json({
      success: true,
      message: 'If the email exists in our system, a password reset link has been sent.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: error.errors[0].message,
        },
        { status: 400 }
      );
    }

    console.error('[Forgot Password] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
