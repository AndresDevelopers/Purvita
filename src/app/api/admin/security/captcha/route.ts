import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { invalidateAdminSecurityConfigCache } from '@/lib/security/admin-security-config';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const CaptchaConfigSchema = z.object({
  captcha_enabled: z.boolean(),
  captcha_provider: z.enum(['recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'turnstile']).nullable(),
  captcha_threshold: z.number().min(0).max(1),
});

/**
 * GET /api/admin/security/captcha
 * Get CAPTCHA configuration
 * Requires: manage_security permission
 * Note: Site key and secret key are read from environment variables only
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[CAPTCHA Config] Service role key not configured, returning default config');
      return NextResponse.json({
        captcha_enabled: false,
        captcha_provider: null,
        captcha_threshold: 0.5,
      });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('security_settings')
      .select('captcha_enabled, captcha_provider, captcha_threshold')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching CAPTCHA config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CAPTCHA configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || {
      captcha_enabled: false,
      captcha_provider: null,
      captcha_threshold: 0.5,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/security/captcha:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/security/captcha
 * Update CAPTCHA configuration
 * Requires: manage_security permission
 */
export const PUT = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const validatedData = CaptchaConfigSchema.parse(body);

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('security_settings')
      .update(validatedData)
      .eq('id', 'global');

    if (error) {
      console.error('Error updating CAPTCHA config:', error);
      return NextResponse.json(
        { error: 'Failed to update CAPTCHA configuration' },
        { status: 500 }
      );
    }

    // Invalidate cache after successful update
    invalidateAdminSecurityConfigCache();

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated CAPTCHA configuration',
      {
        ...extractRequestMetadata(request),
        action: 'update_captcha_config',
        resourceType: 'captcha_config',
        captchaEnabled: validatedData.captcha_enabled,
        captchaProvider: validatedData.captcha_provider,
        captchaThreshold: validatedData.captcha_threshold,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error in PUT /api/admin/security/captcha:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

