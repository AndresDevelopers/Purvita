import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { sanitizeHtml } from '@/lib/security/input-sanitization';
import { getAdminClient } from '@/lib/supabase/admin';
import { SentryLogger } from '@/modules/observability/services/sentry-logger';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';
import { z } from 'zod';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

// ✅ SECURITY: Attachment validation schema
const AttachmentSchema = z.object({
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.string().url(),
  name: z.string().max(255),
  size: z.number().max(10 * 1024 * 1024), // Max 10MB
});

const AttachmentsArraySchema = z.array(AttachmentSchema).max(5);

// ✅ SECURITY: Validate attachment URLs are from Supabase Storage
function validateAttachmentUrls(attachments: z.infer<typeof AttachmentSchema>[]): boolean {
  const validDomain = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!validDomain) return false;

  return attachments.every(att => att.url.startsWith(validDomain));
}

/**
 * GET /api/admin/notes
 * Fetch all admin notes
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async () => {
  try {
    const supabase = getAdminClient();

    // Fetch notes with creator information
    const { data: notes, error: notesError } = await supabase
      .from('admin_notes')
      .select(`
        id,
        content,
        attachments,
        created_at,
        updated_at,
        created_by,
        profiles:created_by (
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (notesError) {
      SentryLogger.captureException(notesError, {
        module: 'admin',
        operation: 'fetch_notes',
        tags: { error_type: 'database_error' },
      });
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'admin',
      operation: 'get_notes',
      tags: { error_type: 'internal_error' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * POST /api/admin/notes
 * Create a new admin note
 * Requires: manage_content permission
 */
export const POST = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const supabase = getAdminClient();

    // Parse request body
    const body = await request.json();
    const { content, attachments = [] } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // ✅ SECURITY: Validate attachments
    try {
      const validatedAttachments = AttachmentsArraySchema.parse(attachments);

      if (validatedAttachments.length > 0 && !validateAttachmentUrls(validatedAttachments)) {
        return NextResponse.json({ error: 'Invalid attachment URL' }, { status: 400 });
      }
    } catch (_error) {
      return NextResponse.json({ error: 'Invalid attachment format' }, { status: 400 });
    }

    // ✅ SECURITY: Sanitize content to prevent XSS
    const sanitizedContent = sanitizeHtml(content.trim());

    // Create note
    const { data: note, error: insertError } = await supabase
      .from('admin_notes')
      .insert({
        content: sanitizedContent,
        attachments,
        created_by: request.user.id,
      })
      .select(`
        id,
        content,
        attachments,
        created_at,
        updated_at,
        created_by,
        profiles:created_by (
          name,
          email
        )
      `)
      .single();

    if (insertError) {
      SentryLogger.captureException(insertError, {
        module: 'admin',
        operation: 'create_note',
        tags: { error_type: 'database_error' },
      });
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    // ✅ SECURITY: Audit log for note creation
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.INFO,
      'Admin created a new note',
      {
        adminId: request.user.id,
        noteId: note.id,
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
      },
      false
    );

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'admin',
      operation: 'post_notes',
      tags: { error_type: 'internal_error' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * PUT /api/admin/notes
 * Update an admin note
 * Requires: manage_content permission
 */
export const PUT = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const supabase = getAdminClient();

    // Parse request body
    const body = await request.json();
    const { id, content, attachments } = body;

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // ✅ SECURITY: Validate attachments
    if (attachments) {
      try {
        const validatedAttachments = AttachmentsArraySchema.parse(attachments);

        if (validatedAttachments.length > 0 && !validateAttachmentUrls(validatedAttachments)) {
          return NextResponse.json({ error: 'Invalid attachment URL' }, { status: 400 });
        }
      } catch (_error) {
        return NextResponse.json({ error: 'Invalid attachment format' }, { status: 400 });
      }
    }

    // ✅ SECURITY: Sanitize content to prevent XSS
    const sanitizedContent = sanitizeHtml(content.trim());

    // Update note
    const { data: note, error: updateError } = await supabase
      .from('admin_notes')
      .update({
        content: sanitizedContent,
        attachments: attachments || [],
      })
      .eq('id', id)
      .select(`
        id,
        content,
        attachments,
        created_at,
        updated_at,
        created_by,
        profiles:created_by (
          name,
          email
        )
      `)
      .single();

    if (updateError) {
      SentryLogger.captureException(updateError, {
        module: 'admin',
        operation: 'update_note',
        tags: { error_type: 'database_error' },
      });
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    // ✅ SECURITY: Audit log for note update
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.INFO,
      'Admin updated a note',
      {
        adminId: request.user.id,
        noteId: id,
        hasAttachments: attachments ? attachments.length > 0 : false,
      },
      false
    );

    return NextResponse.json({ note });
  } catch (error) {
    SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'admin',
      operation: 'put_notes',
      tags: { error_type: 'internal_error' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * DELETE /api/admin/notes
 * Delete an admin note
 * Requires: manage_content permission
 */
export const DELETE = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const supabase = getAdminClient();

    // Get note ID from query params
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('id');

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    // Delete note
    const { error: deleteError } = await supabase
      .from('admin_notes')
      .delete()
      .eq('id', noteId);

    if (deleteError) {
      SentryLogger.captureException(deleteError, {
        module: 'admin',
        operation: 'delete_note',
        tags: { error_type: 'database_error' },
      });
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    // ✅ SECURITY: Audit log for note deletion
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.INFO,
      'Admin deleted a note',
      {
        adminId: request.user.id,
        noteId,
      },
      false
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
      module: 'admin',
      operation: 'delete_notes',
      tags: { error_type: 'internal_error' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});