/**
 * Geolocation Service
 * Detects user's country based on their IP address using free geolocation APIs
 */

interface GeolocationResponse {
  country: string | null;
  countryCode: string | null;
  source: 'ipapi' | 'cloudflare' | 'fallback';
}

/**
 * Normalizes country code to ISO 3166-1 alpha-2 format (2-letter uppercase)
 */
const normalizeCountryCode = (code: string | null | undefined): string | null => {
  if (!code || typeof code !== 'string') {
    return null;
  }

  const normalized = code.trim().toUpperCase();
  
  // Validate it's a 2-letter code
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
};

/**
 * Detects country from Cloudflare headers (if behind Cloudflare)
 */
const detectFromCloudflare = (request?: Request): string | null => {
  if (!request) {
    return null;
  }

  // Cloudflare provides CF-IPCountry header
  const cfCountry = request.headers.get('CF-IPCountry');
  return normalizeCountryCode(cfCountry);
};

/**
 * Detects country using ipapi.co (free, no API key required)
 * Rate limit: 1,000 requests per day for free tier
 */
const detectFromIpApi = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      headers: {
        'User-Agent': 'PurVita-Network/1.0',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.warn('[Geolocation] ipapi.co returned non-OK status:', response.status);
      return null;
    }

    const data = await response.json();
    return normalizeCountryCode(data?.country_code);
  } catch (error) {
    console.warn('[Geolocation] Failed to detect country from ipapi.co:', error);
    return null;
  }
};

/**
 * Detects country using ipapi.co (free, HTTPS supported, no API key required)
 * Rate limit: 30,000 requests per month for free tier
 */
const detectFromIpApiCom = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.warn('[Geolocation] ipapi.co returned non-OK status:', response.status);
      return null;
    }

    const data = await response.json();
    return normalizeCountryCode(data?.country_code);
  } catch (error) {
    console.warn('[Geolocation] Failed to detect country from ipapi.co:', error);
    return null;
  }
};

/**
 * Client-side geolocation detection
 * Tries multiple sources in order of preference
 */
export const detectUserCountryClient = async (): Promise<GeolocationResponse> => {
  // Try ipapi.co first (more reliable)
  let countryCode = await detectFromIpApi();
  if (countryCode) {
    return {
      country: countryCode,
      countryCode,
      source: 'ipapi',
    };
  }

  // Fallback to ip-api.com
  countryCode = await detectFromIpApiCom();
  if (countryCode) {
    return {
      country: countryCode,
      countryCode,
      source: 'ipapi',
    };
  }

  // No country detected
  return {
    country: null,
    countryCode: null,
    source: 'fallback',
  };
};

/**
 * Server-side geolocation detection
 * Tries Cloudflare headers first, then falls back to IP APIs
 */
export const detectUserCountryServer = async (request?: Request): Promise<GeolocationResponse> => {
  // Try Cloudflare headers first (fastest and most reliable if behind Cloudflare)
  if (request) {
    const cfCountry = detectFromCloudflare(request);
    if (cfCountry) {
      return {
        country: cfCountry,
        countryCode: cfCountry,
        source: 'cloudflare',
      };
    }
  }

  // Fallback to IP geolocation APIs
  return detectUserCountryClient();
};

/**
 * Extract IP address from request headers
 */
export const extractIpFromRequest = (request: Request): string | null => {
  const headerOrder = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];

  for (const header of headerOrder) {
    const value = request.headers.get(header);
    if (value) {
      const [first] = value.split(',');
      if (first) {
        return first.trim();
      }
    }
  }

  return null;
};

