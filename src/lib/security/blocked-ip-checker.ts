/**
 * Blocked IP Checker for Middleware
 * 
 * This module provides IP blocking functionality that works in Edge Runtime (middleware).
 * Uses direct Supabase REST API calls instead of the client library.
 */

interface BlockedIPResult {
  isBlocked: boolean
  reason?: string
  blockId?: string
}

/**
 * Check if an IP is blocked using direct Supabase REST API
 * This works in Edge Runtime (middleware) unlike the regular Supabase client
 */
export async function isIPBlocked(ip: string): Promise<BlockedIPResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[BlockedIPChecker] Missing Supabase credentials')
      return { isBlocked: false }
    }

    // Build query to check for blocked IP
    // Filter: ip_address = ip AND (expires_at IS NULL OR expires_at > NOW())
    const now = new Date().toISOString()
    const url = new URL(`${supabaseUrl}/rest/v1/blocked_ips`)
    url.searchParams.set('ip_address', `eq.${ip}`)
    url.searchParams.set('or', `(expires_at.is.null,expires_at.gt.${now})`)
    url.searchParams.set('select', 'id,reason,expires_at')
    url.searchParams.set('limit', '1')

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('[BlockedIPChecker] API error:', response.status, response.statusText)
      return { isBlocked: false }
    }

    const data = await response.json()

    if (Array.isArray(data) && data.length > 0) {
      const blockedIP = data[0]
      return {
        isBlocked: true,
        reason: blockedIP.reason,
        blockId: blockedIP.id,
      }
    }

    return { isBlocked: false }
  } catch (error) {
    console.error('[BlockedIPChecker] Error checking IP:', error)
    // Fail open - don't block if we can't check
    return { isBlocked: false }
  }
}

