import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

export const PUT = withAdminPermission('manage_content', async (request, context) => {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();
    const params = await (context?.params as Promise<{ id: string }>);
    const { id } = params;
    const body = await request.json();

    const { 
      title, 
      title_es, 
      title_en, 
      description, 
      description_es, 
      description_en, 
      content, 
      is_active,
      show_on_all_pages,
      target_pages
    } = body;

    if ((!title && !title_es && !title_en) || !content || !Array.isArray(content)) {
      return NextResponse.json(
        { error: 'At least one title (ES or EN) and content are required' },
        { status: 400 }
      );
    }

    const { data: tutorial, error } = await supabase
      .from('tutorials')
      .update({
        title: title || title_es || title_en || '',
        title_es: title_es || null,
        title_en: title_en || null,
        description: description || description_es || description_en || '',
        description_es: description_es || null,
        description_en: description_en || null,
        content,
        is_active: is_active ?? true,
        show_on_all_pages: show_on_all_pages ?? false,
        target_pages: target_pages || [],
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tutorial:', error);
      return NextResponse.json(
        { error: 'Failed to update tutorial' },
        { status: 500 }
      );
    }

    if (!tutorial) {
      return NextResponse.json(
        { error: 'Tutorial not found' },
        { status: 404 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated tutorial',
      {
        ...extractRequestMetadata(request),
        action: 'update_tutorial',
        resourceType: 'tutorial',
        tutorialId: id,
        isActive: tutorial.is_active,
      },
      true
    );

    return NextResponse.json({ tutorial });
  } catch (error) {
    console.error('Error in PUT /api/admin/tutorials/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const DELETE = withAdminPermission('manage_content', async (request, context) => {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();
    const params = await (context?.params as Promise<{ id: string }>);
    const { id } = params;

    const { error } = await supabase
      .from('tutorials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tutorial:', error);
      return NextResponse.json(
        { error: 'Failed to delete tutorial' },
        { status: 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Deleted tutorial',
      {
        ...extractRequestMetadata(request),
        action: 'delete_tutorial',
        resourceType: 'tutorial',
        tutorialId: id,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/tutorials/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});