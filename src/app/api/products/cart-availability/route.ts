import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '@/lib/supabase';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { createSecurityModule } from '@/modules/security/factories/security-module';

const { rateLimitService } = createSecurityModule();

const missingColumnHint =
  'Supabase reports that the "cart_visibility_countries" column is missing. ' +
  'Run docs/migrations/20250418_add_product_cart_visibility_countries.sql to add it.';

const normalizeCountry = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

const isMissingCartVisibilityColumn = (error: { code?: string; message?: string } | null) => {
  return Boolean(error?.code === '42703' && error?.message?.includes('cart_visibility_countries'));
};

const createServiceRoleClient = () => {
  const serviceClient = getServiceRoleClient();
  if (serviceClient) {
    return { client: serviceClient, mode: 'service' as const };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return {
      client: createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
      mode: 'service' as const,
    };
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  return {
    client: createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    mode: 'anon' as const,
  };
};

const resolveAvailabilityFromSettings = async (country: string): Promise<boolean> => {
  try {
    const settings = await getAppSettings();
    const normalizedCountry = country.trim().toUpperCase();

    for (const entry of settings.currencies ?? []) {
      const code = entry.code?.toUpperCase?.() ?? '';
      if (!code) {
        continue;
      }

      const countries = (entry.countryCodes ?? []).map((countryCode) => countryCode.toUpperCase());
      if (countries.length === 0) {
        // Global currency applies everywhere
        return true;
      }

      if (countries.includes(normalizedCountry)) {
        return true;
      }
    }
  } catch (error) {
    console.warn('[CartAvailability] Failed to resolve fallback from app settings', error);
  }

  return false;
};

const buildSuccessResponse = (params: {
  allowed: boolean;
  country: string;
  source: 'service' | 'anon' | 'settings-fallback';
}) => {
  return NextResponse.json({
    allowed: params.allowed,
    country: params.country,
    source: params.source,
  });
};

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Rate limiting to prevent abuse of public endpoint
  const guard = await rateLimitService.guard(request, 'api:products:cart-availability:get');
  if (!guard.result.allowed) {
    const response = NextResponse.json(
      rateLimitService.buildErrorPayload(guard.locale),
      { status: 429 }
    );
    return rateLimitService.applyHeaders(response, guard.result);
  }

  const country = normalizeCountry(request.nextUrl.searchParams.get('country'));

  if (!country) {
    return NextResponse.json(
      {
        error: 'invalid-country',
        message: 'Provide a two-letter ISO 3166-1 alpha-2 country code.',
      },
      { status: 400 },
    );
  }

  const client = createServiceRoleClient();
  if (!client) {
    const fallbackAllowed = await resolveAvailabilityFromSettings(country);
    return buildSuccessResponse({
      allowed: fallbackAllowed,
      country,
      source: 'settings-fallback',
    });
  }

  try {
    const { data, error } = await client
      .client
      .from('products')
      .select('id')
      .contains('cart_visibility_countries', [country])
      .limit(1);

    if (error) {
      if (isMissingCartVisibilityColumn(error)) {
        return NextResponse.json(
          {
            error: 'schema-out-of-date',
            message: missingColumnHint,
          },
          { status: 503 },
        );
      }

      throw error;
    }

    const response = buildSuccessResponse({
      allowed: Boolean(data && data.length > 0),
      country,
      source: client.mode,
    });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    console.error('[CartAvailability] Failed to check availability', error);

    const availability = await resolveAvailabilityFromSettings(country);
    if (availability) {
      const response = buildSuccessResponse({
        allowed: true,
        country,
        source: 'settings-fallback',
      });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    // ✅ SECURITY: Sanitize error message in production
    const message = process.env.NODE_ENV === 'production'
      ? 'Failed to check cart availability'
      : (error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        error: 'cart-availability-error',
        message,
      },
      { status: 500 },
    );
  }
}
