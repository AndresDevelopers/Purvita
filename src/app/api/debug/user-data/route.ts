import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAdminAuth } from '@/lib/auth/with-auth';

/**
 * 🔒 SECURITY: This endpoint exposes sensitive user data and MUST be admin-only
 *
 * GET /api/debug/user-data?userId=xxx
 *
 * Returns comprehensive user data for debugging purposes including:
 * - Profile information
 * - Subscription details
 * - Wallet balance and transactions
 * - MLM phase information
 *
 * ⚠️ CRITICAL: This endpoint requires admin authentication due to sensitive data exposure
 * Protected by: withAdminAuth wrapper
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Fetch all user data
    const [
      { data: profile, error: profileError },
      { data: subscription, error: subscriptionError },
      { data: wallet, error: walletError },
      { data: walletTxns, error: walletTxnsError },
      { data: phase, error: phaseError },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('wallet_txns').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('phases').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    return NextResponse.json({
      userId,
      timestamp: new Date().toISOString(),
      data: {
        profile: profileError ? { error: profileError.message } : profile,
        subscription: subscriptionError ? { error: subscriptionError.message } : subscription,
        wallet: walletError ? { error: walletError.message } : wallet,
        walletTxns: walletTxnsError ? { error: walletTxnsError.message } : walletTxns,
        phase: phaseError ? { error: phaseError.message } : phase,
      },
      errors: {
        profile: profileError?.message,
        subscription: subscriptionError?.message,
        wallet: walletError?.message,
        walletTxns: walletTxnsError?.message,
        phase: phaseError?.message,
      },
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
