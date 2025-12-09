import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * GET /api/payment-requests
 * Get user's payment requests
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new PaymentWalletService(supabase);
    const requests = await service.getUserPaymentRequests(user.id);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Failed to fetch payment requests:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/payment-requests
 * Create a new payment request
 *
 * ✅ SECURITY NOTES:
 * - CSRF protection: validates CSRF token
 * - Rate limiting: enforced at middleware level
 * - Ownership validation: service validates wallet exists and is active
 * - Withdrawal limits: service checks daily/monthly/single transaction limits
 * - Duplicate prevention: service checks for existing pending requests
 *
 * Note: walletId refers to payment_wallets (PayPal, Stripe, etc.), not user wallets.
 * The service validates that the selected payment wallet is active and valid.
 */
export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(req);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { walletId, amountCents } = body;

    if (!walletId || typeof amountCents !== 'number') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Validate amount is positive
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    const service = new PaymentWalletService(supabase);

    // ✅ SECURITY FIX #4: Service validates:
    // - Wallet exists and is active
    // - Amount is within min/max limits
    // - User hasn't exceeded withdrawal limits (daily/monthly/single)
    // - User doesn't have pending requests
    const request = await service.createPaymentRequest(user.id, walletId, amountCents);

    return NextResponse.json({ request });
  } catch (error) {
    console.error('Failed to create payment request:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
