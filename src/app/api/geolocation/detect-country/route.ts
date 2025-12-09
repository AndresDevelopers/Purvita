import { NextRequest, NextResponse } from 'next/server';
import { detectUserCountryServer } from '@/lib/services/geolocation-service';

/**
 * API endpoint to detect user's country based on their IP address
 * Uses Cloudflare headers if available, otherwise falls back to IP geolocation APIs
 * 
 * GET /api/geolocation/detect-country
 * 
 * Response:
 * {
 *   "country": "US",
 *   "countryCode": "US",
 *   "source": "cloudflare" | "ipapi" | "fallback"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const result = await detectUserCountryServer(request);

    if (!result.countryCode) {
      return NextResponse.json(
        {
          error: 'country-not-detected',
          message: 'Could not detect country from IP address',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      country: result.countryCode,
      countryCode: result.countryCode,
      source: result.source,
    });
  } catch (error) {
    console.error('[DetectCountry] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'detection-failed',
        message,
      },
      { status: 500 }
    );
  }
}

