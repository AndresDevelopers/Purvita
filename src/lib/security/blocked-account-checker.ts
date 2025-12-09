/**
 * Blocked Account Checker
 * 
 * Verifies if a user account is blocked in the user_blacklist table.
 * Works in both Edge Runtime (middleware) and Node.js runtime (API routes).
 */

export interface BlockedAccountResult {
  isBlocked: boolean;
  reason?: string;
  fraudType?: string;
  blockId?: string;
  expiresAt?: string | null;
  blockedBy?: string;
}

/**
 * Check if a user account is blocked using direct Supabase REST API
 * This works in Edge Runtime (middleware) unlike the regular Supabase client
 */
export async function isAccountBlocked(userId: string): Promise<BlockedAccountResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[BlockedAccountChecker] Missing Supabase credentials');
      return { isBlocked: false };
    }

    // Build query to check for blocked account
    // Filter: user_id = userId AND (expires_at IS NULL OR expires_at > NOW())
    const now = new Date().toISOString();
    const url = new URL(`${supabaseUrl}/rest/v1/user_blacklist`);
    url.searchParams.set('user_id', `eq.${userId}`);
    url.searchParams.set('or', `(expires_at.is.null,expires_at.gt.${now})`);
    url.searchParams.set('select', 'id,reason,fraud_type,expires_at,blocked_by');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[BlockedAccountChecker] API error:', response.status, response.statusText);
      return { isBlocked: false };
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const block = data[0];
      return {
        isBlocked: true,
        reason: block.reason,
        fraudType: block.fraud_type,
        blockId: block.id,
        expiresAt: block.expires_at,
        blockedBy: block.blocked_by,
      };
    }

    return { isBlocked: false };
  } catch (error) {
    console.error('[BlockedAccountChecker] Error checking blocked account:', error);
    // Fail open - don't block on error to avoid locking out legitimate users
    return { isBlocked: false };
  }
}

/**
 * Check if a user account is blocked using Supabase client (for server-side use)
 * Use this in API routes where you have access to the full Supabase client
 */
export async function isAccountBlockedWithClient(
  userId: string,
  supabase: unknown
): Promise<BlockedAccountResult> {
  try {
    const now = new Date().toISOString();

    const { data, error } = await (supabase as any)
      .from('user_blacklist')
      .select('id, reason, fraud_type, expires_at, blocked_by')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[BlockedAccountChecker] Error checking blocked account:', error);
      return { isBlocked: false };
    }

    if (data) {
      return {
        isBlocked: true,
        reason: data.reason,
        fraudType: data.fraud_type,
        blockId: data.id,
        expiresAt: data.expires_at,
        blockedBy: data.blocked_by,
      };
    }

    return { isBlocked: false };
  } catch (error) {
    console.error('[BlockedAccountChecker] Error checking blocked account:', error);
    return { isBlocked: false };
  }
}

