import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

export const GET = withAdminPermission('manage_content', async () => {
  try {
    const supabase = await createClient();

    const { data: tutorials, error } = await supabase
      .from('tutorials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tutorials:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tutorials' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tutorials: tutorials || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/tutorials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const POST = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
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
      .insert({
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
      .select()
      .single();

    if (error) {
      console.error('Error creating tutorial:', error);
      return NextResponse.json(
        { error: 'Failed to create tutorial' },
        { status: 500 }
      );
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Created tutorial',
      {
        ...extractRequestMetadata(request),
        action: 'create_tutorial',
        resourceType: 'tutorial',
        tutorialId: tutorial.id,
        isActive: tutorial.is_active,
      },
      true
    );

    return NextResponse.json({ tutorial });
  } catch (error) {
    console.error('Error in POST /api/admin/tutorials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});