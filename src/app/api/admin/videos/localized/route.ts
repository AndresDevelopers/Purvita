import { NextResponse } from 'next/server';
import { getVideosWithLocale } from '@/lib/services/video-display-service';
import type { Locale } from '@/i18n/config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = (searchParams.get('locale') || 'en') as Locale;

    const videos = await getVideosWithLocale(locale);
    return NextResponse.json(videos);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
