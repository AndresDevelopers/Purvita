import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const BlockAccountSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(1),
  fraud_type: z.enum(['payment_fraud', 'chargeback_abuse', 'account_takeover', 'velocity_abuse', 'multiple_accounts', 'synthetic_identity', 'other']),
  expires_at: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * GET /api/admin/security/blocked-accounts
 * Get all blocked accounts
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Blocked Accounts] Service role key not configured, returning empty array');
      return NextResponse.json([]);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('user_blacklist')
      .select(`
        *,
        profiles:user_id (
          email,
          name
        )
      `)
      .order('blocked_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocked accounts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blocked accounts' },
        { status: 500 }
      );
    }

    // Transform data to include user info
    const transformedData = (data || []).map((item: any) => ({
      ...item,
      user_email: item.profiles?.email,
      user_name: item.profiles?.name,
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in GET /api/admin/security/blocked-accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/security/blocked-accounts
 * Block a user account
 * Requires: manage_security permission
 */
export const POST = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const validatedData = BlockAccountSchema.parse(body);

    const supabase = createAdminClient();

    // Get admin user ID from the request (set by withAdminPermission middleware)
    const adminUserId = (request as any).user?.id;

    const { error } = await supabase
      .from('user_blacklist')
      .insert({
        user_id: validatedData.user_id,
        reason: validatedData.reason,
        fraud_type: validatedData.fraud_type,
        expires_at: validatedData.expires_at || null,
        notes: validatedData.notes || null,
        blocked_by: adminUserId || null,
      });

    if (error) {
      console.error('Error blocking account:', error);
      return NextResponse.json(
        { error: 'Failed to block account' },
        { status: 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Blocked user account',
      {
        ...extractRequestMetadata(request),
        action: 'block_account',
        resourceType: 'blocked_account',
        userId: validatedData.user_id,
        reason: validatedData.reason,
        fraudType: validatedData.fraud_type,
        expiresAt: validatedData.expires_at,
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

    console.error('Error in POST /api/admin/security/blocked-accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

