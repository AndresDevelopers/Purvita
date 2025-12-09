import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';

/**
 * GET /api/profile/debug-summary
 * Debug endpoint to check profile summary status
 */
export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;
  const userEmail = req.user.email;

  try {
    // Test database connection
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabase = createAdminClient();

    // Check if user profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // Check if required tables exist
    const tables = ['profiles', 'phases', 'subscriptions', 'wallets', 'orders', 'network_commissions', 'payout_accounts'];
    const tableStatus: Record<string, boolean> = {};

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);
        tableStatus[table] = !error;
      } catch {
        tableStatus[table] = false;
      }
    }

    return NextResponse.json({
      status: 'ok',
      userId,
      userEmail,
      profile: profile ? { id: profile.id, email: profile.email, name: profile.name } : null,
      profileError: profileError ? { message: profileError.message, code: profileError.code } : null,
      tables: tableStatus,
      env: {
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    });
  } catch (error) {
    console.error('[Debug Summary] Error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
});
