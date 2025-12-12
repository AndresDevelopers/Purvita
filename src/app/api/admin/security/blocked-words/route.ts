import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';
import { clearBlockedWordsCache } from '@/lib/security/content-moderation';

const BlockWordSchema = z.object({
  word: z.string().min(1),
  category: z.enum(['profanity', 'spam', 'hate', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

/**
 * GET /api/admin/security/blocked-words
 * Get all blocked words
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Blocked Words] Service role key not configured, returning empty array');
      return NextResponse.json([]);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('blocked_words')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocked words:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blocked words' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/admin/security/blocked-words:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/security/blocked-words
 * Add a new blocked word
 * Requires: manage_security permission
 */
export const POST = withAdminPermission('manage_security', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const validatedData = BlockWordSchema.parse(body);

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('blocked_words')
      .insert(validatedData);

    if (error) {
      console.error('Error adding blocked word:', error);
      return NextResponse.json(
        { error: 'Failed to add blocked word' },
        { status: 500 }
      );
    }

    // Clear cache so new word takes effect immediately
    clearBlockedWordsCache();

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Added blocked word',
      {
        ...extractRequestMetadata(request),
        action: 'add_blocked_word',
        resourceType: 'blocked_word',
        word: validatedData.word,
        category: validatedData.category,
        severity: validatedData.severity,
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

    console.error('Error in POST /api/admin/security/blocked-words:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

