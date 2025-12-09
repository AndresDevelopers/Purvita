import { NextResponse } from 'next/server';
import { isCaptchaEnabled } from '@/lib/security/captcha-validator';

/**
 * GET /api/auth/captcha-config
 * Get CAPTCHA configuration for client-side rendering
 * Public endpoint - no authentication required
 */
export async function GET() {
  try {
    const config = await isCaptchaEnabled();

    return NextResponse.json(config);
  } catch (error) {
    console.error('[CaptchaConfig] Error fetching config:', error);
    return NextResponse.json(
      { enabled: false, provider: null, siteKey: null },
      { status: 200 } // Return 200 with disabled config instead of error
    );
  }
}

