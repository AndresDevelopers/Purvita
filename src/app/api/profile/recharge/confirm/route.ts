import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const ConfirmRechargeSchema = z.object({
  provider: z.enum(['paypal', 'stripe']),
  rechargeId: z.string().min(6).max(64),
  amountCents: z.number().int().positive(),
  currency: z.string().default(PAYMENT_CONSTANTS.CURRENCIES.DEFAULT),
  mode: z.literal('test'),
});

export async function POST(request: Request) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const payload = ConfirmRechargeSchema.parse(body);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();
    const walletService = new WalletService(adminClient);

    const reference = `test:${payload.provider}:${payload.rechargeId}`;

    const result = await walletService.recordRecharge({
      userId: user.id,
      amountCents: payload.amountCents,
      gateway: payload.provider,
      gatewayRef: reference,
      currency: payload.currency ?? PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
      metadata: {
        environment: 'test',
        simulated: true,
        recharge_id: payload.rechargeId,
        provider_mode: payload.mode,
      },
    });

    return NextResponse.json({
      ok: true,
      alreadyProcessed: (result as any)?.alreadyProcessed ?? false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    console.error('Failed to confirm test recharge', error);
    return NextResponse.json({ error: 'Unable to confirm recharge' }, { status: 500 });
  }
}
