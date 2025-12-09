import { NextResponse } from 'next/server';
import { createWalletService } from '@/modules/multilevel/factories/wallet-service-factory';
import { createClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * Admin endpoint to add funds to a user's wallet
 * POST /api/admin/wallet/add-funds
 *
 * Body:
 * {
 *   userId: string;
 *   amountCents: number;
 *   reason?: 'admin_adjustment' | 'phase_bonus' | 'withdrawal' | 'sale_commission';
 *   note?: string;
 * }
 * Requires: manage_payments permission
 */
export const POST = withAdminPermission('manage_payments', async (req) => {
  // ✅ SECURITY: Validate CSRF token
  const { requireCsrfToken } = await import('@/lib/security/csrf-protection');
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  try {
    const supabase = await createClient();

    // Parse request body
    const body = await req.json();
    const { userId, amountCents, reason = 'admin_adjustment', note } = body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    if (typeof amountCents !== 'number' || isNaN(amountCents)) {
      return NextResponse.json({ error: 'Invalid amountCents' }, { status: 400 });
    }

    if (amountCents === 0) {
      return NextResponse.json({ error: 'Amount cannot be zero' }, { status: 400 });
    }

    // Security: Limit maximum single transaction to prevent accidents or abuse
    const MAX_SINGLE_TRANSACTION_CENTS = 100000000; // $1,000,000
    if (Math.abs(amountCents) > MAX_SINGLE_TRANSACTION_CENTS) {
      return NextResponse.json({
        error: 'Amount exceeds maximum limit',
        maxAmount: `$${(MAX_SINGLE_TRANSACTION_CENTS / 100).toLocaleString()}`,
        requestedAmount: `$${(Math.abs(amountCents) / 100).toLocaleString()}`,
      }, { status: 400 });
    }

    // Verify target user exists
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Add funds
    const walletService = createWalletService();
    await walletService.addFunds(userId, amountCents, reason, req.user.id, note);

    // Get updated balance
    const updatedBalance = await walletService.getBalance(userId);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Admin added/deducted funds to user wallet',
      {
        ...extractRequestMetadata(req),
        action: 'admin_add_funds',
        resourceType: 'user_wallet',
        targetUserId: userId,
        amountCents: amountCents,
        reason: reason,
        hasNote: !!note,
        newBalanceCents: updatedBalance?.balance_cents,
      },
      true
    );

    return NextResponse.json({
      success: true,
      message: `Successfully ${amountCents > 0 ? 'added' : 'deducted'} ${Math.abs(amountCents / 100).toFixed(2)} USD ${amountCents > 0 ? 'to' : 'from'} ${targetUser.name || targetUser.email}'s wallet`,
      balance: updatedBalance,
    });
  } catch (error) {
    console.error('Failed to add funds to wallet:', error);
    const message = error instanceof Error ? error.message : 'Failed to add funds';
    return NextResponse.json({ error: message }, { status: 500 });
  }
})
