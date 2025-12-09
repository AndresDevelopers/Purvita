import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const BlockIPSchema = z.object({
  ip_address: z.string().ip(),
  reason: z.string().min(1),
  expires_at: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * GET /api/admin/security/blocked-ips
 * Get all blocked IPs
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Blocked IPs] Service role key not configured, returning empty array');
      return NextResponse.json([]);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('blocked_ips')
      .select('*')
      .order('blocked_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocked IPs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blocked IPs' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/admin/security/blocked-ips:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/security/blocked-ips
 * Block a new IP address
 * Requires: manage_security permission
 */
export const POST = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const validatedData = BlockIPSchema.parse(body);

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('blocked_ips')
      .insert({
        ip_address: validatedData.ip_address,
        reason: validatedData.reason,
        expires_at: validatedData.expires_at || null,
        notes: validatedData.notes || null,
      });

    if (error) {
      console.error('Error blocking IP:', error);
      // Return more specific error message
      const errorMessage = error.code === '23505' 
        ? 'This IP address is already blocked'
        : error.message || 'Failed to block IP address';
      return NextResponse.json(
        { error: errorMessage },
        { status: error.code === '23505' ? 409 : 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Blocked IP address',
      {
        ...extractRequestMetadata(request),
        action: 'block_ip',
        resourceType: 'blocked_ip',
        ipAddress: validatedData.ip_address,
        reason: validatedData.reason,
        expiresAt: validatedData.expires_at,
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

    console.error('Error in POST /api/admin/security/blocked-ips:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

