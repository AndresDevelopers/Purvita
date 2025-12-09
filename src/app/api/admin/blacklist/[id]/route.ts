import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/auth/admin-auth';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const UpdateBlacklistSchema = z.object({
  reason: z.string().min(10).max(500).optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * DELETE /api/admin/blacklist/[id]
 * Remove user from blacklist
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }


  const authResult = await verifyAdminAuth();

  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Get blacklist entry
    const { data: entry, error: fetchError } = await supabase
      .from('user_blacklist')
      .select('*, user:profiles!user_id(name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      return NextResponse.json(
        { error: 'Blacklist entry not found' },
        { status: 404 }
      );
    }

    // Delete entry
    const { error: deleteError } = await supabase
      .from('user_blacklist')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    logger.security('User removed from blacklist', {
      userId: entry.user_id,
      userName: entry.user?.name,
      adminId: authResult.user?.id,
    });

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin removed user from blacklist: ${entry.user?.name} (${entry.user?.email})`,
      {
        ...extractRequestMetadata(req),
        userId: authResult.user?.id,
        action: 'remove_from_blacklist',
        resourceType: 'blacklist',
        resourceId: id,
        targetUserId: entry.user_id,
        targetUserName: entry.user?.name,
        targetUserEmail: entry.user?.email,
      },
      true
    );

    return NextResponse.json({
      message: 'User removed from blacklist',
    });
  } catch (error) {
    logger.error('Failed to remove user from blacklist', error as Error);
    return NextResponse.json(
      { error: 'Failed to remove user from blacklist' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/blacklist/[id]
 * Update blacklist entry
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }


  const authResult = await verifyAdminAuth();

  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const validated = UpdateBlacklistSchema.parse(body);

    const supabase = createAdminClient();

    // Update entry
    const { data: entry, error: updateError } = await supabase
      .from('user_blacklist')
      .update({
        ...(validated.reason && { reason: validated.reason }),
        ...(validated.expiresAt && { expires_at: validated.expiresAt }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Blacklist entry not found' },
          { status: 404 }
        );
      }
      throw updateError;
    }

    logger.security('Blacklist entry updated', {
      entryId: id,
      adminId: authResult.user?.id,
    });

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin updated blacklist entry: ${id}`,
      {
        ...extractRequestMetadata(req),
        userId: authResult.user?.id,
        action: 'update_blacklist_entry',
        resourceType: 'blacklist',
        resourceId: id,
        updatedFields: Object.keys(validated),
      },
      true
    );

    return NextResponse.json({
      message: 'Blacklist entry updated',
      entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    logger.error('Failed to update blacklist entry', error as Error);
    return NextResponse.json(
      { error: 'Failed to update blacklist entry' },
      { status: 500 }
    );
  }
}
