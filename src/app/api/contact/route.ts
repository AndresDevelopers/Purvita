import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import type { Locale } from '@/i18n/config';
import { submitContactMessage } from '@/modules/contact/services/contact-service';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { shouldBypassRateLimiting } from '@/lib/security/trusted-agent-helpers';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const ContactRequestSchema = z.object({
  name: z.string().min(1).max(180),
  email: z.string().email().max(180),
  message: z.string().min(1).max(4000),
  locale: z.string().optional(),
  // Honeypot field - should always be empty
  website: z.string().max(0).optional(),
});

const { rateLimitService } = createSecurityModule();

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    // Check if this is a trusted agent that can bypass rate limiting
    const bypassRateLimit = shouldBypassRateLimiting(request);

    if (!bypassRateLimit) {
      const guard = await rateLimitService.guard(request, 'api:contact:post');

      if (!guard.result.allowed) {
        const response = NextResponse.json(
          rateLimitService.buildErrorPayload(guard.locale),
          { status: 429 },
        );

        return rateLimitService.applyHeaders(response, guard.result);
      }
    }

    const body = await request.json();
    const payload = ContactRequestSchema.parse(body);

    // Honeypot check - if 'website' field is filled, it's a bot
    if (payload.website && payload.website.length > 0) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 },
      );
    }

    // Get locale from guard if rate limiting was applied, otherwise default to 'en'
    const locale = (payload.locale as Locale | undefined) ?? (bypassRateLimit ? 'en' : (await rateLimitService.guard(request, 'api:contact:post')).locale) ?? 'en';

    await submitContactMessage({
      name: payload.name,
      email: payload.email,
      message: payload.message,
      locale,
    });

    const response = NextResponse.json({ success: true });

    // Only apply rate limit headers if rate limiting was applied
    if (!bypassRateLimit) {
      const guard = await rateLimitService.guard(request, 'api:contact:post');
      return rateLimitService.applyHeaders(response, guard.result);
    }

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API] Failed to handle contact submission', error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
