import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import {
  ComingSoonConfigurationError,
  ComingSoonInactiveError,
  MailchimpRequestError,
  subscribeToComingSoonWaitlist,
} from '@/modules/site-status/services/coming-soon-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const SubscribeRequestSchema = z.object({
  email: z.string().email('A valid email address is required'),
});

export async function POST(request: Request) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) return csrfError;

    const rawBody = await request.json();
    const { email } = SubscribeRequestSchema.parse(rawBody);

    const status = await subscribeToComingSoonWaitlist(email);

    return NextResponse.json({ status });
  } catch (error) {
    console.error('[API] Coming soon waitlist error', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    if (error instanceof ComingSoonInactiveError) {
      return NextResponse.json(
        {
          error: 'coming_soon_inactive',
        },
        { status: 409 },
      );
    }

    if (error instanceof ComingSoonConfigurationError) {
      return NextResponse.json(
        {
          error: 'configuration_missing',
          message: error.message,
        },
        { status: 503 },
      );
    }

    if (error instanceof MailchimpRequestError) {
      return NextResponse.json(
        {
          error: 'mailchimp_error',
          message: error.message,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: 'internal_error',
      },
      { status: 500 },
    );
  }
}
