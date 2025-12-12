import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const ThreatIntelConfigSchema = z.object({
  abuse_ch_enabled: z.boolean(),
  abuse_ch_urlhaus_enabled: z.boolean(),
  abuse_ch_threatfox_enabled: z.boolean(),
  abuse_ch_cache_ttl: z.number().min(60),
  abuse_ch_log_threats: z.boolean(),
  virustotal_enabled: z.boolean(),
  virustotal_cache_ttl: z.number().min(60),
  virustotal_threshold: z.number().min(1).max(10),
  google_safe_browsing_enabled: z.boolean(),
  google_safe_browsing_cache_ttl: z.number().min(60),
  threat_detection_strategy: z.enum(['any', 'majority', 'all']),
});

/**
 * GET /api/admin/security/threat-intelligence
 * Get threat intelligence configuration
 * API keys are read from environment variables only
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check API key configuration from environment variables
    const virusTotalApiKeyConfigured = !!process.env.VIRUSTOTAL_API_KEY;
    const googleSafeBrowsingApiKeyConfigured = !!process.env.GOOGLE_SAFE_BROWSING_API_KEY;

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Threat Intelligence] Service role key not configured, returning default config');
      return NextResponse.json({
        abuse_ch_enabled: false,
        abuse_ch_urlhaus_enabled: false,
        abuse_ch_threatfox_enabled: false,
        abuse_ch_cache_ttl: 3600,
        abuse_ch_log_threats: true,
        virustotal_enabled: false,
        virustotal_api_key_configured: virusTotalApiKeyConfigured,
        virustotal_cache_ttl: 7200,
        virustotal_threshold: 2,
        google_safe_browsing_enabled: false,
        google_safe_browsing_api_key_configured: googleSafeBrowsingApiKeyConfigured,
        google_safe_browsing_cache_ttl: 1800,
        threat_detection_strategy: 'any',
      });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('security_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching threat intelligence config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch configuration' },
        { status: 500 }
      );
    }

    // Return default config if no data exists
    if (!data) {
      return NextResponse.json({
        abuse_ch_enabled: false,
        abuse_ch_urlhaus_enabled: false,
        abuse_ch_threatfox_enabled: false,
        abuse_ch_cache_ttl: 3600,
        abuse_ch_log_threats: true,
        virustotal_enabled: false,
        virustotal_api_key_configured: virusTotalApiKeyConfigured,
        virustotal_cache_ttl: 7200,
        virustotal_threshold: 2,
        google_safe_browsing_enabled: false,
        google_safe_browsing_api_key_configured: googleSafeBrowsingApiKeyConfigured,
        google_safe_browsing_cache_ttl: 1800,
        threat_detection_strategy: 'any',
      });
    }

    return NextResponse.json({
      abuse_ch_enabled: data.abuse_ch_enabled ?? false,
      abuse_ch_urlhaus_enabled: data.abuse_ch_urlhaus_enabled ?? false,
      abuse_ch_threatfox_enabled: data.abuse_ch_threatfox_enabled ?? false,
      abuse_ch_cache_ttl: data.abuse_ch_cache_ttl_seconds ?? 3600,
      abuse_ch_log_threats: data.abuse_ch_log_threats ?? true,
      virustotal_enabled: data.virustotal_enabled ?? false,
      virustotal_api_key_configured: virusTotalApiKeyConfigured,
      virustotal_cache_ttl: data.virustotal_cache_ttl_seconds ?? 7200,
      virustotal_threshold: data.virustotal_threshold ?? 2,
      google_safe_browsing_enabled: data.google_safe_browsing_enabled ?? false,
      google_safe_browsing_api_key_configured: googleSafeBrowsingApiKeyConfigured,
      google_safe_browsing_cache_ttl: data.google_safe_browsing_cache_ttl_seconds ?? 1800,
      threat_detection_strategy: data.threat_intelligence_strategy ?? 'any',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/security/threat-intelligence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/security/threat-intelligence
 * Update threat intelligence configuration
 * Requires: manage_security permission
 */
export const PUT = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const validatedData = ThreatIntelConfigSchema.parse(body);

    // Map frontend field names to database column names
    const dbData = {
      abuse_ch_enabled: validatedData.abuse_ch_enabled,
      abuse_ch_urlhaus_enabled: validatedData.abuse_ch_urlhaus_enabled,
      abuse_ch_threatfox_enabled: validatedData.abuse_ch_threatfox_enabled,
      abuse_ch_cache_ttl_seconds: validatedData.abuse_ch_cache_ttl,
      abuse_ch_log_threats: validatedData.abuse_ch_log_threats,
      virustotal_enabled: validatedData.virustotal_enabled,
      virustotal_cache_ttl_seconds: validatedData.virustotal_cache_ttl,
      virustotal_threshold: validatedData.virustotal_threshold,
      google_safe_browsing_enabled: validatedData.google_safe_browsing_enabled,
      google_safe_browsing_cache_ttl_seconds: validatedData.google_safe_browsing_cache_ttl,
      threat_intelligence_strategy: validatedData.threat_detection_strategy,
    };

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
        .update(dbData)
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating threat intelligence config:', error);
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        );
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('security_settings')
        .insert(dbData);

      if (error) {
        console.error('Error inserting threat intelligence config:', error);
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        );
      }
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated threat intelligence configuration',
      {
        ...extractRequestMetadata(request),
        action: 'update_threat_intelligence_config',
        resourceType: 'threat_intelligence_config',
        abuseChEnabled: validatedData.abuse_ch_enabled,
        virusTotalEnabled: validatedData.virustotal_enabled,
        googleSafeBrowsingEnabled: validatedData.google_safe_browsing_enabled,
        detectionStrategy: validatedData.threat_detection_strategy,
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

    console.error('Error in PUT /api/admin/security/threat-intelligence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

