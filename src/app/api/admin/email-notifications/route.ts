import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

interface EmailTemplate {
  id: string;
  name: string;
  subject_en: string;
  subject_es: string;
  body_en: string;
  body_es: string;
}

/**
 * GET /api/admin/email-notifications
 * Retrieve all email notification templates
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async () => {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[GET /api/admin/email-notifications] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to load email templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    console.error('[GET /api/admin/email-notifications] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/email-notifications
 * Update email notification templates
 * Requires: manage_content permission
 */
export const PUT = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { templates } = body as { templates: EmailTemplate[] };

    if (!templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'Invalid request: templates array is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Update each template
    for (const template of templates) {
      const { error } = await supabase
        .from('email_templates')
        .upsert({
          id: template.id,
          name: template.name,
          subject_en: template.subject_en,
          subject_es: template.subject_es,
          body_en: template.body_en,
          body_es: template.body_es,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error(`[PUT /api/admin/email-notifications] Error updating template ${template.id}:`, error);
        return NextResponse.json(
          { error: `Failed to update template: ${template.name}` },
          { status: 500 }
        );
      }
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated email notification templates',
      {
        ...extractRequestMetadata(request),
        action: 'update_email_templates',
        resourceType: 'email_templates',
        templateCount: templates.length,
      },
      true
    );

    return NextResponse.json({
      success: true,
      message: 'Email templates updated successfully'
    });
  } catch (error) {
    console.error('[PUT /api/admin/email-notifications] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
});

