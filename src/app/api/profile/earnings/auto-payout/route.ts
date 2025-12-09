import { NextResponse } from 'next/server';
import { createProfileEarningsService } from '@/modules/profile/factories/profile-earnings-service-factory';
import { withAuth } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/profile/earnings/auto-payout
 * Procesa un pago automático si el usuario tiene más de $9 disponibles
 * SECURED: Uses Supabase session authentication
 */
export const POST = withAuth<unknown>(async (req) => {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(req);
  if (csrfError) return csrfError;

  const userId = req.user.id;

  try {
    const service = createProfileEarningsService();
    const result = await service.processAutoPayout(userId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process auto payout';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

/**
 * PATCH /api/profile/earnings/auto-payout
 * Actualiza el umbral mínimo configurado para procesar pagos automáticos
 * SECURED: Uses Supabase session authentication
 */
export const PATCH = withAuth<unknown>(async (req) => {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(req);
  if (csrfError) return csrfError;

  const userId = req.user.id;

  try {
    const payload = await req.json();
    const service = createProfileEarningsService();
    const status = await service.updateAutoPayoutThreshold(userId, payload);

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update auto payout threshold';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

/**
 * GET /api/profile/earnings/auto-payout
 * Obtiene el estado de configuración de pagos automáticos
 * SECURED: Uses Supabase session authentication
 */
export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;

  try {
    const service = createProfileEarningsService();
    const status = await service.getAutoPayoutStatus(userId);

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get auto payout status';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
