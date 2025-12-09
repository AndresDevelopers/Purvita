import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';
import { clearBlockedWordsCache } from '@/lib/security/content-moderation';

/**
 * DELETE /api/admin/security/blocked-words/[id]
 * Remove a blocked word
 * Requires: manage_security permission
 */
export const DELETE = withAdminPermission('manage_security', async (request, context: { params: Promise<{ id: string }> }) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('blocked_words')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing blocked word:', error);
      return NextResponse.json(
        { error: 'Failed to remove blocked word' },
        { status: 500 }
      );
    }

    // Clear cache so removal takes effect immediately
    clearBlockedWordsCache();

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Removed blocked word',
      {
        ...extractRequestMetadata(request),
        action: 'remove_blocked_word',
        resourceType: 'blocked_word',
        blockedWordId: id,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/security/blocked-words/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

