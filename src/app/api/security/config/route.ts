/**
 * Public Security Configuration Endpoint
 * 
 * Returns public-safe security configuration for client-side use.
 * This allows affiliate pages and other public pages to respect admin security settings.
 */

import { NextResponse } from 'next/server';
import { getAdminSecurityConfig } from '@/lib/security/admin-security-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/security/config
 * Returns public security configuration
 */
export async function GET() {
  try {
    const config = await getAdminSecurityConfig();
    
    // Return only public-safe configuration
    // DO NOT expose sensitive settings like thresholds or internal limits
    return NextResponse.json({
      captcha: {
        enabled: config.captchaEnabled,
        provider: config.captchaProvider,
        // Site key should come from environment variables on the client
      },
      session: {
        timeoutMinutes: config.sessionTimeoutMinutes,
        warningMinutes: config.sessionWarningMinutes,
      },
      // DO NOT expose rate limiting details to prevent abuse
    });
  } catch (error) {
    console.error('[Security Config API] Error fetching config:', error);
    
    // Return safe defaults on error
    return NextResponse.json({
      captcha: {
        enabled: false,
        provider: null,
      },
      session: {
        timeoutMinutes: 30,
        warningMinutes: 2,
      },
    });
  }
}

