import { NextResponse } from 'next/server';
import { getPublicAdvertisingScripts } from '@/modules/advertising/services/advertising-scripts-service';

/**
 * GET /api/public/advertising-scripts
 * Get public advertising scripts configuration (for client-side injection)
 * No authentication required - this is public data
 */
export async function GET() {
  try {
    const config = await getPublicAdvertisingScripts();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[API] Failed to load public advertising scripts', error);
    
    // Return empty config on error to prevent breaking the page
    return NextResponse.json({
      facebookPixel: { enabled: false, id: null, script: null },
      tiktokPixel: { enabled: false, id: null, script: null },
      gtm: { enabled: false, containerId: null, script: null },
    });
  }
}

