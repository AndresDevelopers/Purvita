import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';
import { withAdminPermission } from '@/lib/auth/with-auth';

/**
 * GET /api/admin/payment-requests
 * Get all payment requests (admin)
 * Requires: manage_payments permission
 */
export const GET = withAdminPermission('manage_payments', async (req) => {
  try {
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const service = new PaymentWalletService(supabase);
    const requests = status
      ? await service.getPaymentRequestsByStatus(status as any)
      : await service.getAllPaymentRequests();

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Failed to fetch payment requests:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
})
