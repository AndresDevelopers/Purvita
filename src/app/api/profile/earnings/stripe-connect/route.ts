import { NextRequest, NextResponse } from 'next/server';
import { EnvironmentConfigurationError } from '@/lib/env';
import { createProfileEarningsService } from '@/modules/profile/factories/profile-earnings-service-factory';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest) {
  // ✅ SECURITY FIX: Use proper Supabase authentication instead of x-user-id header
  // Previous implementation used x-user-id header which could be spoofed by attackers
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id; // ✅ This userId is authenticated and cannot be spoofed

  try {
    const service = createProfileEarningsService();
    const result = await service.ensureStripeAccount(userId);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return NextResponse.json(
        {
          error: 'environment-configuration-missing',
          message: error.message,
          missing: error.missingKeys,
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to initialize Stripe Connect';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
