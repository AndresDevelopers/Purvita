import { NextResponse } from 'next/server';
import { getVideosWithLocale } from '@/lib/services/video-display-service';
import type { Locale } from '@/i18n/config';

/**
 * Public endpoint to get published videos with localized content
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = (searchParams.get('locale') || 'en') as Locale;

    const allVideos = await getVideosWithLocale(locale);
    
    // Filter only published videos for public access
    const publishedVideos = allVideos.filter(video => video.is_published);

    return NextResponse.json(publishedVideos);
  } catch (error: unknown) {
    console.error('API error:', error);
    // ✅ SECURITY: Sanitize error message in production
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Internal server error');

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
