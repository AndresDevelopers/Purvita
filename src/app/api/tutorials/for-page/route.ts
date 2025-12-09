import { NextRequest, NextResponse } from 'next/server';
import { getTutorialsForPage } from '@/lib/services/tutorial-service';

/**
 * GET /api/tutorials/for-page?path=/dashboard&locale=es
 * Get tutorials that should be shown on a specific page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pagePath = searchParams.get('path');
    const locale = (searchParams.get('locale') || 'es') as 'es' | 'en';

    if (!pagePath) {
      return NextResponse.json(
        { error: 'Page path is required' },
        { status: 400 }
      );
    }

    const tutorials = await getTutorialsForPage(pagePath, locale);

    return NextResponse.json({ 
      tutorials,
      count: tutorials.length,
      page: pagePath,
      locale
    });
  } catch (error) {
    console.error('Error in GET /api/tutorials/for-page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
