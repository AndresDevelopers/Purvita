import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';

/**
 * GET /api/payment-wallets
 * Get active payment wallets for users (public payment options)
 *
 * ✅ SECURITY: Only returns public information about payment providers (PayPal, Stripe, etc.)
 * Does NOT return sensitive information like API keys, credentials, or admin notes.
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
    const allWallets = await service.getActiveWallets();

    // ✅ SECURITY FIX #3: Filter sensitive information before returning to client
    // Only expose public data needed for payment UI
    const publicWallets = allWallets.map(wallet => ({
      id: wallet.id,
      provider: wallet.provider,
      wallet_name: wallet.wallet_name,
      min_amount_cents: wallet.min_amount_cents,
      max_amount_cents: wallet.max_amount_cents,
      instructions: wallet.instructions,
      // QR code URL is stored in metadata if available
      qr_code_url: (wallet.metadata?.qr_code_url as string | undefined) || null,
      // ❌ DO NOT expose: wallet_address, credentials, api_key, secret_key, admin_notes, etc.
    }));

    return NextResponse.json({ wallets: publicWallets });
  } catch (error) {
    console.error('Failed to fetch payment wallets:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment wallets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
