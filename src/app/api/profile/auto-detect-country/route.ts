import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { detectUserCountryServer } from '@/lib/services/geolocation-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * API endpoint to automatically detect and save user's country to their profile
 * Only updates if the user doesn't already have a country set
 *
 * POST /api/profile/auto-detect-country
 *
 * Response:
 * {
 *   "success": true,
 *   "country": "US",
 *   "source": "cloudflare" | "ipapi" | "fallback",
 *   "updated": true | false
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    // Create Supabase client with proper cookie handling
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          message: 'You must be logged in to use this endpoint',
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log('[AutoDetectCountry] Authenticated user:', userId);

    // Check if user already has a country set
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('[AutoDetectCountry] Failed to fetch profile:', fetchError);
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    console.log('[AutoDetectCountry] Current profile country:', profile?.country);

    // If user already has a country, don't override it
    if (profile?.country) {
      console.log('[AutoDetectCountry] User already has country, skipping');
      return NextResponse.json({
        success: true,
        country: profile.country,
        source: 'existing',
        updated: false,
        message: 'User already has a country set',
      });
    }

    // Detect country from IP
    console.log('[AutoDetectCountry] Detecting country from IP...');
    const result = await detectUserCountryServer(request);
    console.log('[AutoDetectCountry] Detection result:', result);

    if (!result.countryCode) {
      console.error('[AutoDetectCountry] Detection failed - no country code returned');
      return NextResponse.json(
        {
          error: 'country-not-detected',
          message: 'Could not detect country from IP address',
        },
        { status: 404 }
      );
    }

    // Save to user profile
    console.log('[AutoDetectCountry] Updating profile with country:', result.countryCode);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ country: result.countryCode })
      .eq('id', userId);

    if (updateError) {
      console.error('[AutoDetectCountry] Failed to update profile:', updateError);
      throw new Error(`Failed to save country to profile: ${updateError.message}`);
    }

    console.log(`[AutoDetectCountry] ✅ Successfully saved country ${result.countryCode} for user ${userId} from ${result.source}`);

    return NextResponse.json({
      success: true,
      country: result.countryCode,
      source: result.source,
      updated: true,
    });
  } catch (error) {
    console.error('[AutoDetectCountry] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'auto-detect-failed',
        message,
      },
      { status: 500 }
    );
  }
}

