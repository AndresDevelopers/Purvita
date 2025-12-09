import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { EnvironmentConfigurationError } from '@/lib/env';
import { createSubscriptionLifecycleService } from '@/modules/multilevel/factories/subscription-service-factory';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const CancelSubscriptionSchema = z
  .object({
    locale: z.string().optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  let body: z.infer<typeof CancelSubscriptionSchema>;
  try {
    const json = await req.json().catch(() => ({}));
    body = CancelSubscriptionSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const lifecycleService = createSubscriptionLifecycleService();
    const result = await lifecycleService.cancelSubscription({
      userId: user.id,
      reason: 'user',
      locale: body?.locale,
    });

    if (!result.subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ canceled: result.canceled, alreadyCanceled: result.alreadyCanceled });
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      console.error('Missing environment configuration for subscription cancellation', error);
      return NextResponse.json(
        {
          error: 'environment-configuration-missing',
          message: error.message,
          missing: error.missingKeys,
        },
        { status: 503 },
      );
    }
    console.error('Failed to cancel subscription from API', error);
    return NextResponse.json({ error: 'Unable to cancel subscription' }, { status: 500 });
  }
}
