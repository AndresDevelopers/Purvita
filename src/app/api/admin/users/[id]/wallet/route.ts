import { NextResponse } from 'next/server';
import { createWalletService } from '@/modules/multilevel/factories/wallet-service-factory';
import { createClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';

/**
 * Admin endpoint to get a user's wallet balance
 * GET /api/admin/users/[id]/wallet
 * Requires: manage_users permission
 */
export const GET = withAdminPermission('manage_users', async (req, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id: userId } = await context.params;
    const supabase = await createClient();

    // Verify target user exists
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get wallet balance
    const walletService = createWalletService();
    const wallet = await walletService.getBalance(userId);

    return NextResponse.json({
      balance_cents: wallet?.balance_cents ?? 0,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to fetch wallet balance:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch wallet balance';
    return NextResponse.json({ error: message }, { status: 500 });
  }
})
