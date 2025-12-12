import { NextRequest, NextResponse } from 'next/server';
import { subscribeToMailchimp } from '@/lib/services/mailchimp-service';
import { z } from 'zod';
import { rateLimit } from '@/lib/utils/rate-limit';

/**
 * 🔒 SECURITY IMPROVEMENTS:
 * - Added Zod validation for email format
 * - Added rate limiting to prevent spam/abuse
 * - Sanitized name input with length limits
 *
 * POST /api/auth/mailchimp-subscribe
 *
 * Subscribes a user to the Mailchimp mailing list during registration.
 * This endpoint is public but rate-limited to prevent abuse.
 */

const MailchimpSubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Rate limiting to prevent spam (5 attempts per 5 minutes per IP)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';

  const rateLimitResult = await rateLimit(ip, {
    limit: 5,
    window: 300, // 5 minutes
    prefix: 'mailchimp:subscribe',
  });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many subscription attempts. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    );
  }

  try {
    const body = await request.json();

    // ✅ SECURITY: Validate and sanitize inputs with Zod
    const { email, name } = MailchimpSubscribeSchema.parse(body);

    // Subscribe to Mailchimp
    const result = await subscribeToMailchimp({
      email,
      firstName: name || '',
      tags: ['registration'],
    });

    if (!result.success) {
      // Log the error but don't fail the registration
      console.error('Mailchimp subscription failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 200 } // Return 200 to not block registration
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address',
          details: error.issues[0]?.message ?? 'Invalid email address',
        },
        { status: 400 }
      );
    }

    console.error('Error in mailchimp-subscribe endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 } // Return 200 to not block registration
    );
  }
}
