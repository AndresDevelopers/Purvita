import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

// ✅ SECURITY: Validation schema for wallet updates
const UpdateWalletSchema = z.object({
  account_id: z.string().min(1).max(100).optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  provider: z.enum(['stripe', 'paypal']).optional(),
}).strict();

/**
 * PATCH /api/admin/payment-wallets/[id]
 * Update payment wallet configuration (admin)
 * Requires: manage_payments permission
 */
export const PATCH = withAdminPermission('manage_payments', async (
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const body = await req.json();

    // ✅ SECURITY: Validate request body with Zod
    const validation = UpdateWalletSchema.safeParse(body);
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
    const wallet = await service.updateWallet(id, validation.data);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated payment wallet',
      {
        ...extractRequestMetadata(req),
        action: 'update_payment_wallet',
        resourceType: 'payment_wallet',
        walletId: id,
        changes: validation.data,
      },
      true
    );

    return NextResponse.json({ wallet });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to update payment wallet:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to update payment wallet';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

/**
 * DELETE /api/admin/payment-wallets/[id]
 * Delete a payment wallet (admin)
 * Requires: manage_payments permission
 */
export const DELETE = withAdminPermission('manage_payments', async (
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const service = new PaymentWalletService(supabase);
    await service.deleteWallet(id);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Deleted payment wallet',
      {
        ...extractRequestMetadata(req),
        action: 'delete_payment_wallet',
        resourceType: 'payment_wallet',
        walletId: id,
      },
      true
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to delete payment wallet:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to delete payment wallet';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
