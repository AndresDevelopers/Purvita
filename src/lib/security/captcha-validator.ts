/**
 * CAPTCHA Validator
 * 
 * Validates CAPTCHA tokens based on the admin configuration.
 * Supports multiple CAPTCHA providers:
 * - reCAPTCHA v2
 * - reCAPTCHA v3
 * - hCaptcha
 * - Cloudflare Turnstile
 */

import { createAdminClient } from '@/lib/supabase/server';

export interface CaptchaValidationResult {
  success: boolean;
  score?: number;
  error?: string;
  provider?: string;
}

export interface CaptchaConfig {
  captcha_enabled: boolean;
  captcha_provider: 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'turnstile' | null;
  captcha_threshold: number;
}

/**
 * Get CAPTCHA configuration from database
 */
async function getCaptchaConfig(): Promise<CaptchaConfig | null> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[CaptchaValidator] Service role key not configured');
      return null;
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('security_settings')
      .select('captcha_enabled, captcha_provider, captcha_threshold')
      .single();

    if (error) {
      console.error('[CaptchaValidator] Error fetching config:', error);
      return null;
    }

    return data as CaptchaConfig;
  } catch (error) {
    console.error('[CaptchaValidator] Error getting config:', error);
    return null;
  }
}

/**
 * Verify reCAPTCHA v2 or v3 token
 */
async function verifyRecaptcha(token: string, version: 'v2' | 'v3'): Promise<CaptchaValidationResult> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('[CaptchaValidator] reCAPTCHA secret key not configured');
    return { success: false, error: 'CAPTCHA not configured' };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.[0] || 'Verification failed',
        provider: `recaptcha_${version}`,
      };
    }

    return {
      success: true,
      score: version === 'v3' ? data.score : undefined,
      provider: `recaptcha_${version}`,
    };
  } catch (error) {
    console.error('[CaptchaValidator] reCAPTCHA verification error:', error);
    return { success: false, error: 'Verification failed', provider: `recaptcha_${version}` };
  }
}

/**
 * Verify hCaptcha token
 */
async function verifyHcaptcha(token: string): Promise<CaptchaValidationResult> {
  const secretKey = process.env.HCAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('[CaptchaValidator] hCaptcha secret key not configured');
    return { success: false, error: 'CAPTCHA not configured' };
  }

  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.[0] || 'Verification failed',
        provider: 'hcaptcha',
      };
    }

    return {
      success: true,
      provider: 'hcaptcha',
    };
  } catch (error) {
    console.error('[CaptchaValidator] hCaptcha verification error:', error);
    return { success: false, error: 'Verification failed', provider: 'hcaptcha' };
  }
}

/**
 * Verify Cloudflare Turnstile token
 */
async function verifyTurnstile(token: string): Promise<CaptchaValidationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error('[CaptchaValidator] Turnstile secret key not configured');
    return { success: false, error: 'CAPTCHA not configured' };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.[0] || 'Verification failed',
        provider: 'turnstile',
      };
    }

    return {
      success: true,
      provider: 'turnstile',
    };
  } catch (error) {
    console.error('[CaptchaValidator] Turnstile verification error:', error);
    return { success: false, error: 'Verification failed', provider: 'turnstile' };
  }
}

/**
 * Main CAPTCHA validation function
 * Returns success if CAPTCHA is disabled or validation passes
 */
export async function validateCaptcha(token: string | null | undefined): Promise<CaptchaValidationResult> {
  try {
    // Get CAPTCHA configuration
    const config = await getCaptchaConfig();

    // If CAPTCHA is not enabled, allow the request
    if (!config || !config.captcha_enabled) {
      return { success: true };
    }

    // If CAPTCHA is enabled but no token provided (or empty string), reject
    if (!token || token.trim() === '') {
      return { success: false, error: 'CAPTCHA token required' };
    }

    // Validate based on provider
    let result: CaptchaValidationResult;

    switch (config.captcha_provider) {
      case 'recaptcha_v2':
        result = await verifyRecaptcha(token, 'v2');
        break;

      case 'recaptcha_v3':
        result = await verifyRecaptcha(token, 'v3');
        // Check score threshold for v3
        if (result.success && result.score !== undefined) {
          if (result.score < config.captcha_threshold) {
            return {
              success: false,
              error: 'CAPTCHA score too low',
              score: result.score,
              provider: result.provider,
            };
          }
        }
        break;

      case 'hcaptcha':
        result = await verifyHcaptcha(token);
        break;

      case 'turnstile':
        result = await verifyTurnstile(token);
        break;

      default:
        console.warn('[CaptchaValidator] Unknown CAPTCHA provider:', config.captcha_provider);
        return { success: false, error: 'Invalid CAPTCHA provider' };
    }

    return result;
  } catch (error) {
    console.error('[CaptchaValidator] Validation error:', error);
    return { success: false, error: 'CAPTCHA validation failed' };
  }
}

/**
 * Check if CAPTCHA is enabled (for client-side use)
 */
export async function isCaptchaEnabled(): Promise<{
  enabled: boolean;
  provider: string | null;
  siteKey: string | null;
}> {
  try {
    const config = await getCaptchaConfig();

    if (!config || !config.captcha_enabled || !config.captcha_provider) {
      return { enabled: false, provider: null, siteKey: null };
    }

    // Get site key from environment based on provider
    let siteKey: string | null = null;

    switch (config.captcha_provider) {
      case 'recaptcha_v2':
      case 'recaptcha_v3':
        siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;
        break;
      case 'hcaptcha':
        siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || null;
        break;
      case 'turnstile':
        siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
        break;
    }

    return {
      enabled: true,
      provider: config.captcha_provider,
      siteKey,
    };
  } catch (error) {
    console.error('[CaptchaValidator] Error checking if enabled:', error);
    return { enabled: false, provider: null, siteKey: null };
  }
}

