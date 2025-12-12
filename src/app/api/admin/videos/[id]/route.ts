import { NextResponse } from 'next/server';
import { getClassVideoById, updateClassVideo, deleteClassVideo } from '@/lib/services/admin-video-service';
import { getVideoWithTranslations } from '@/lib/services/video-translation-service';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const url = new URL(request.url);
    const withTranslations = url.searchParams.get('translations') === 'true';

    if (withTranslations) {
      const videoWithTranslations = await getVideoWithTranslations(resolvedParams.id);
      
      if (!videoWithTranslations) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(videoWithTranslations);
    }

    const video = await getClassVideoById(resolvedParams.id);

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(video);
  } catch (error: any) {
    console.error('API error:', error);

    // Check if it's a Zod validation error
    if (error.name === 'ZodError') {
      console.error('Zod validation error:', error.issues);
      return NextResponse.json(
        {
          error: 'Database schema mismatch. Please run the migration to add category and visibility columns to class_videos table.',
          details: 'Missing columns: category, visibility'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  // ✅ SECURITY: Validate CSRF token
  const { requireCsrfToken } = await import('@/lib/security/csrf-protection');
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const resolvedParams = await params;
    const body = await request.json();

    // Validar que el video existe
    const existingVideo = await getClassVideoById(resolvedParams.id);
    if (!existingVideo) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Preparar updates para el video base
    const updates: any = {};
    if (body.youtube_id !== undefined) updates.youtube_id = body.youtube_id;
    if (body.category !== undefined) updates.category = body.category;
    if (body.visibility !== undefined) updates.visibility = body.visibility;
    if (body.is_published !== undefined) updates.is_published = body.is_published;
    if (body.is_featured !== undefined) updates.is_featured = body.is_featured;
    if (body.order_index !== undefined) updates.order_index = body.order_index;

    // Mantener compatibilidad con el formato antiguo (title y description directos)
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;

    const updatedVideo = await updateClassVideo(resolvedParams.id, updates);

    // Si se enviaron traducciones, actualizarlas
    if (body.translations && typeof body.translations === 'object') {
      const { upsertVideoTranslation } = await import('@/lib/services/video-translation-service');
      
      for (const [locale, translation] of Object.entries(body.translations)) {
        if (translation && typeof translation === 'object') {
          const t = translation as { title?: string; description?: string };
          if (t.title) {
            await upsertVideoTranslation(
              resolvedParams.id,
              locale,
              t.title,
              t.description || ''
            );
          }
        }
      }
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated class video',
      {
        ...extractRequestMetadata(request),
        action: 'update_video',
        resourceType: 'class_video',
        videoId: resolvedParams.id,
        changes: updates,
      },
      true
    );

    return NextResponse.json(updatedVideo);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  // ✅ SECURITY: Validate CSRF token
  const { requireCsrfToken } = await import('@/lib/security/csrf-protection');
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const resolvedParams = await params;

    // Validar que el video existe
    const existingVideo = await getClassVideoById(resolvedParams.id);
    if (!existingVideo) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    await deleteClassVideo(resolvedParams.id);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Deleted class video',
      {
        ...extractRequestMetadata(request),
        action: 'delete_video',
        resourceType: 'class_video',
        videoId: resolvedParams.id,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}