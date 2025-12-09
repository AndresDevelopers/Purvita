import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const PaymentWalletSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  provider: z.enum(['stripe', 'paypal'], {
    errorMap: () => ({ message: 'Provider must be either stripe or paypal' })
  }),
  account_id: z.string().min(1, 'Account ID is required').max(100, 'Account ID too long'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  status: z.enum(['active', 'inactive']).default('active'),
}).strict(); // Prevent additional fields

/**
 * GET /api/admin/payment-wallets
 * Get all payment wallets (admin)
 * Requires: manage_payments permission
 */
export const GET = withAdminPermission('manage_payments', async () => {
  try {
    const supabase = await createClient();
    const service = new PaymentWalletService(supabase);
    const wallets = await service.getAllWallets();

    return NextResponse.json({ wallets });
  } catch (error) {
    console.error('Failed to fetch payment wallets:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment wallets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

/**
 * POST /api/admin/payment-wallets
 * Create a new payment wallet (admin)
 * Requires: manage_payments permission
 */
export const POST = withAdminPermission('manage_payments', async (req: NextRequest) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  try {
    const supabase = await createClient();
    const body = await req.json();

    // ✅ SECURITY: Validate request body with Zod
    const validation = PaymentWalletSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const service = new PaymentWalletService(supabase);
    const wallet = await service.createWallet(validation.data);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Created payment wallet',
      {
        ...extractRequestMetadata(req),
        action: 'create_payment_wallet',
        resourceType: 'payment_wallet',
        userId: validation.data.user_id,
        provider: validation.data.provider,
        walletId: wallet.id,
      },
      true
    );

    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to create payment wallet:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to create payment wallet';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
