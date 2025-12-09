import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const BlacklistEntrySchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  fraudType: z.enum([
    'payment_fraud',
    'chargeback_abuse',
    'account_takeover',
    'velocity_abuse',
    'multiple_accounts',
    'synthetic_identity',
    'other',
  ]),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  evidence: z.record(z.unknown()).optional(),
});

/**
 * GET /api/admin/blacklist
 * List all blacklisted users
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    const supabase = createAdminClient();

    const { data: blacklist, error } = await supabase
      .from('user_blacklist')
      .select(`
        *,
        user:profiles!user_id(name, email),
        admin:profiles!blocked_by(name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ blacklist });
  } catch (error) {
    logger.error('Failed to fetch blacklist', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch blacklist' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/blacklist
 * Add user to blacklist
 * Requires: manage_security permission
 */
export const POST = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const body = await request.json();
    const validated = BlacklistEntrySchema.parse(body);

    const supabase = createAdminClient();

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', validated.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Add to blacklist
    const { data: entry, error: insertError } = await supabase
      .from('user_blacklist')
      .insert({
        user_id: validated.userId,
        reason: validated.reason,
        fraud_type: validated.fraudType,
        expires_at: validated.expiresAt || null,
        notes: validated.notes,
        evidence: validated.evidence || {},
        blocked_by: request.user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'User is already blacklisted' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    logger.security('User added to blacklist', {
      userId: validated.userId,
      userName: user.name,
      adminId: request.user.id,
      reason: validated.reason,
    });

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin added user to blacklist: ${user.name} (${user.email})`,
      {
        ...extractRequestMetadata(request),
        userId: request.user.id,
        action: 'add_to_blacklist',
        resourceType: 'blacklist',
        resourceId: entry.id,
        targetUserId: validated.userId,
        targetUserName: user.name,
        targetUserEmail: user.email,
        reason: validated.reason,
        fraudType: validated.fraudType,
      },
      true
    );

    return NextResponse.json({
      message: 'User added to blacklist',
      entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    logger.error('Failed to add user to blacklist', error as Error);
    return NextResponse.json(
      { error: 'Failed to add user to blacklist' },
      { status: 500 }
    );
  }
});
