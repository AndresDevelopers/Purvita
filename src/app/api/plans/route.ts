import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/services/plan-service';
import { createSecurityModule } from '@/modules/security/factories/security-module';

const { rateLimitService } = createSecurityModule();

export async function GET(request: Request) {
  const guard = await rateLimitService.guard(request, 'api:plans:get');

  if (!guard.result.allowed) {
    const response = NextResponse.json(
      rateLimitService.buildErrorPayload(guard.locale),
      { status: 429 },
    );

    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    const plans = await getPlans();
    const response = NextResponse.json(plans);
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    console.error('API error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    return rateLimitService.applyHeaders(response, guard.result);
  }
}