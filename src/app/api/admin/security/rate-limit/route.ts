import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { invalidateRateLimitConfigCache } from '@/lib/helpers/rate-limit-config-helper';
import { invalidateAdminSecurityConfigCache } from '@/lib/security/admin-security-config';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const RateLimitConfigSchema = z.object({
  api_rate_limit_requests: z.number().min(1).max(1000),
  api_rate_limit_window_ms: z.number().min(1000),
  login_rate_limit_attempts: z.number().min(1).max(100),
  login_rate_limit_window_seconds: z.number().min(1),
  auto_block_enabled: z.boolean(),
  auto_block_duration_hours: z.number().min(1).max(8760),
  auto_block_min_confidence: z.number().min(0).max(100),
});

/**
 * GET /api/admin/security/rate-limit
 * Get rate limiting and auto-block configuration
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Rate Limit Config] Service role key not configured, returning default config');
      return NextResponse.json({
        api_rate_limit_requests: 60,
        api_rate_limit_window_ms: 60000,
        login_rate_limit_attempts: 5,
        login_rate_limit_window_seconds: 60,
        auto_block_enabled: true,
        auto_block_duration_hours: 24,
        auto_block_min_confidence: 70,
      });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('security_settings')
      .select(
        'api_rate_limit_requests, api_rate_limit_window_ms, login_rate_limit_attempts, login_rate_limit_window_seconds, auto_block_enabled, auto_block_duration_hours, auto_block_min_confidence'
      )
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching rate limit config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch configuration' },
        { status: 500 }
      );
    }

    // Return default config if no data exists
    if (!data) {
      return NextResponse.json({
        api_rate_limit_requests: 60,
        api_rate_limit_window_ms: 60000,
        login_rate_limit_attempts: 5,
        login_rate_limit_window_seconds: 60,
        auto_block_enabled: true,
        auto_block_duration_hours: 24,
        auto_block_min_confidence: 70,
      });
    }

    return NextResponse.json({
      api_rate_limit_requests: data.api_rate_limit_requests ?? 60,
      api_rate_limit_window_ms: data.api_rate_limit_window_ms ?? 60000,
      login_rate_limit_attempts: data.login_rate_limit_attempts ?? 5,
      login_rate_limit_window_seconds: data.login_rate_limit_window_seconds ?? 60,
      auto_block_enabled: data.auto_block_enabled ?? true,
      auto_block_duration_hours: data.auto_block_duration_hours ?? 24,
      auto_block_min_confidence: data.auto_block_min_confidence ?? 70,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/security/rate-limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/security/rate-limit
 * Update rate limiting and auto-block configuration
 * Requires: manage_security permission
 */
export const PUT = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const validatedData = RateLimitConfigSchema.parse(body);

    const supabase = createAdminClient();

    // Check if settings exist
    const { data: existing } = await supabase
      .from('security_settings')
      .select('id')
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('security_settings')
        .update(validatedData)
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating rate limit config:', error);
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        );
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('security_settings')
        .insert(validatedData);

      if (error) {
        console.error('Error inserting rate limit config:', error);
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        );
      }
    }

    // Invalidate both caches after successful update
    await invalidateRateLimitConfigCache();
    invalidateAdminSecurityConfigCache();

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated rate limit configuration',
      {
        ...extractRequestMetadata(request),
        action: 'update_rate_limit_config',
        resourceType: 'rate_limit_config',
        apiRateLimit: validatedData.api_rate_limit_requests,
        loginRateLimit: validatedData.login_rate_limit_attempts,
        autoBlockEnabled: validatedData.auto_block_enabled,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in PUT /api/admin/security/rate-limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

