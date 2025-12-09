import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/utils/rate-limit';
import { z } from 'zod';
import { validateCaptcha } from '@/lib/security/captcha-validator';
import { shouldBypassCaptcha, shouldBypassRateLimiting } from '@/lib/security/trusted-agent-helpers';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';

/**
 * POST /api/auth/register
 *
 * Registration endpoint with CAPTCHA verification and rate limiting.
 *
 * Security features:
 * - Rate limiting by IP address
 * - CAPTCHA verification (if enabled in admin settings)
 * - Password validation
 *
 * Note: CSRF protection is NOT required for registration endpoint as:
 * - Registration is for unauthenticated users (no existing session to protect)
 * - Already protected by rate limiting, CAPTCHA, and honeypot
 * - CSRF is for protecting authenticated users from unwanted actions
 */

// Strict metadata schema for security
const MetadataSchema = z.object({
  referral_code: z.string().max(50).optional(),
  referred_by: z.string().uuid().optional(),
  registration_code: z.string().max(100).optional(),
  affiliate_context: z.string().max(200).optional(),
}).strict();

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  metadata: MetadataSchema.optional(),
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
    // Apply rate limiting based on IP address

    const rateLimitResult = await rateLimit(ip, {
      limit: 5, // 5 registration attempts
      window: 300, // per 5 minutes
      prefix: 'auth:register',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many registration attempts',
        message: 'You have exceeded the maximum number of registration attempts. Please try again later.',
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
    // Validate request body
    const body = await req.json();
    const validatedData = RegisterSchema.parse(body);

    // Honeypot check - if 'website' field is filled, it's a bot
    if (validatedData.website && validatedData.website.length > 0) {
      // ✅ SECURITY: Log honeypot activation
      await SecurityAuditLogger.log(
        SecurityEventType.FRAUD_DETECTED,
        SecurityEventSeverity.CRITICAL,
        'Honeypot field filled in registration form',
        {
          ipAddress: ip,
          userEmail: validatedData.email,
          action: 'honeypot_triggered',
          resourceType: 'registration_form'
        },
        false
      );

      return NextResponse.json(
        {
          error: 'Registration failed',
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
          'CAPTCHA verification failed on registration',
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

    // Prepare user metadata
    const userMetadata = {
      name: validatedData.name,
      ...validatedData.metadata,
    };

    // Attempt registration
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: userMetadata,
      },
    });

    if (error) {
      // Sanitize error messages in production
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Registration failed. Please try again.'
        : error.message;

      return NextResponse.json(
        {
          error: 'Registration failed',
          message: errorMessage,
        },
        { status: 400 }
      );
    }

    // ✅ CRITICAL SECURITY FIX: Prevent self-referral fraud
    if (data.user && validatedData.metadata?.referred_by) {
      if (data.user.id === validatedData.metadata.referred_by) {
        console.error('[SECURITY] Self-referral attempt detected', {
          userId: data.user.id,
          attemptedReferrer: validatedData.metadata.referred_by,
          ipAddress: ip,
        });

        // Delete the just-created user to prevent fraud
        try {
          await supabase.auth.admin.deleteUser(data.user.id);
        } catch (deleteError) {
          console.error('[SECURITY] Failed to delete self-referral user:', deleteError);
        }

        // Log critical security event
        await SecurityAuditLogger.log(
          SecurityEventType.FRAUD_DETECTED,
          SecurityEventSeverity.CRITICAL,
          'Self-referral attempt blocked during registration',
          {
            userId: data.user.id,
            ipAddress: ip,
            email: validatedData.email,
            action: 'self_referral_blocked',
            resourceType: 'user_registration'
          },
          false
        );

        return NextResponse.json(
          {
            error: 'Invalid referral',
            message: 'Self-referral is not allowed',
          },
          { status: 400 }
        );
      }
    }

    // Return success with user data only
    // ✅ SECURITY: Tokens are stored in HTTP-only cookies by Supabase, not exposed in response body
    return NextResponse.json(
      {
        success: true,
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
        } : null,
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
      console.error('Registration error:', error);
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

