/**
 * Admin IP Whitelist
 *
 * Manages IP whitelisting for admin access
 * Provides additional security layer for admin panel access
 */

import { getAdminClient } from '@/lib/supabase/admin';

export interface AdminIPWhitelistEntry {
  id: string;
  ip_address: string;
  description: string | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Cache for whitelist (refresh every 5 minutes)
let cachedWhitelist: AdminIPWhitelistEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if IP whitelisting is enabled
 */
export async function isAdminIPWhitelistEnabled(): Promise<boolean> {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('admin_ip_whitelist_settings')
      .select('enabled')
      .eq('id', 'global')
      .single();

    if (error) {
      console.error('[AdminIPWhitelist] Error checking if enabled:', error);
      return false;
    }

    return data?.enabled ?? false;
  } catch (error) {
    console.error('[AdminIPWhitelist] Error in isEnabled:', error);
    return false;
  }
}

/**
 * Get all whitelisted IPs from database
 */
export async function getAdminIPWhitelist(): Promise<AdminIPWhitelistEntry[]> {
  // Check cache
  const now = Date.now();
  if (cachedWhitelist && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedWhitelist;
  }

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('admin_ip_whitelist')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminIPWhitelist] Error fetching whitelist:', error);
      return [];
    }

    // Update cache
    cachedWhitelist = data || [];
    cacheTimestamp = now;

    return cachedWhitelist;
  } catch (error) {
    console.error('[AdminIPWhitelist] Error in getWhitelist:', error);
    return [];
  }
}

/**
 * Check if an IP address is whitelisted
 */
export async function isAdminIPWhitelisted(ipAddress: string): Promise<boolean> {
  try {
    // First check if whitelisting is enabled
    const isEnabled = await isAdminIPWhitelistEnabled();

    // If whitelisting is disabled, allow all IPs
    if (!isEnabled) {
      return true;
    }

    // Get whitelist
    const whitelist = await getAdminIPWhitelist();

    // Check if IP is in whitelist
    const isWhitelisted = whitelist.some(entry => {
      // Exact match
      if (entry.ip_address === ipAddress) {
        return true;
      }

      // CIDR range match (e.g., 192.168.1.0/24)
      if (entry.ip_address.includes('/')) {
        return isIPInCIDR(ipAddress, entry.ip_address);
      }

      return false;
    });

    return isWhitelisted;
  } catch (error) {
    console.error('[AdminIPWhitelist] Error checking IP:', error);
    // On error, deny access for security
    return false;
  }
}

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const mask = -1 << (32 - parseInt(bits, 10));

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

/**
 * Invalidate whitelist cache
 */
export function invalidateAdminIPWhitelistCache(): void {
  cachedWhitelist = null;
  cacheTimestamp = 0;
}

/**
 * Middleware helper for admin routes
 */
export async function checkAdminIPWhitelist(request: Request): Promise<Response | null> {
  // Get IP address from request
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Check if IP is whitelisted
  const isWhitelisted = await isAdminIPWhitelisted(ipAddress);

  if (!isWhitelisted) {
    console.warn(`[AdminIPWhitelist] Access denied for IP: ${ipAddress}`);

    return new Response(
      JSON.stringify({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access the admin panel.',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null;
}
