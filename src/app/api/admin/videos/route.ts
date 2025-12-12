import { NextResponse } from 'next/server';
import { ClassVideoSchema } from '@/lib/models/definitions';
import { getAllClassVideos, createClassVideo } from '@/lib/services/admin-video-service';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * GET /api/admin/videos
 * Get all class videos
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const visibility = searchParams.get('visibility')?.split(',').filter(Boolean);
    const levels = searchParams.get('levels')?.split(',').map(Number).filter((n) => !isNaN(n));

    const videos = await getAllClassVideos({ visibility, levels });
    return NextResponse.json(videos);
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
});

export const POST = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const rawBody = await request.json();

    // Extract translations if present
    const translations = rawBody.translations;
    delete rawBody.translations;

    // Get first available translation as fallback
    const firstTranslation = translations && typeof translations === 'object'
      ? Object.values(translations).find((t: any) => t?.title) as { title?: string; description?: string } | undefined
      : undefined;

    const payloadResult = ClassVideoSchema.safeParse({
      ...rawBody,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      // Use first available translation as fallback for title/description
      title: rawBody.title || firstTranslation?.title || 'Untitled',
      description: rawBody.description || firstTranslation?.description || '',
    });

    if (!payloadResult.success) {
      console.error('Invalid class video payload', payloadResult.error.flatten());
      return NextResponse.json(
        {
          error: 'Invalid video payload',
          details: payloadResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...videoData } = payloadResult.data;
    const createdVideo = await createClassVideo(videoData);

    // If translations were provided, save them
    if (translations && typeof translations === 'object' && createdVideo.id) {
      const { upsertVideoTranslation } = await import('@/lib/services/video-translation-service');

      for (const [locale, translation] of Object.entries(translations)) {
        if (translation && typeof translation === 'object') {
          const t = translation as { title?: string; description?: string };
          if (t.title) {
            await upsertVideoTranslation(
              createdVideo.id,
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
      'Created class video',
      {
        ...extractRequestMetadata(request),
        action: 'create_video',
        resourceType: 'class_video',
        videoId: createdVideo.id,
        youtubeId: createdVideo.youtube_id,
        category: createdVideo.category,
      },
      true
    );

    return NextResponse.json(createdVideo, { status: 201 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
});