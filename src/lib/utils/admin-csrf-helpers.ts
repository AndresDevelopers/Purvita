/**
 * CSRF Token Helpers for Admin Operations
 *
 * Centralized utilities for managing CSRF tokens in client-side code
 * Fixes encoding issues and provides consistent API for admin operations
 */

/**
 * Gets CSRF token from meta tag or fetches from API
 * Handles URL encoding/decoding properly to fix "Invalid CSRF token" errors
 *
 * @param retries - Number of retries if token is not available (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 500)
 * @returns Promise<string> - The CSRF token
 * @throws Error if token cannot be obtained
 */
export async function getCsrfToken(retries = 3, retryDelay = 500): Promise<string> {
  // Try to get from meta tag first (fastest)
  if (typeof document !== 'undefined') {
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (metaTag?.content) {
      // Return as-is from meta tag (already decoded)
      return metaTag.content;
    }

    // Fallback: try to read from cookie (with proper decoding)
    const cookieValue = getCsrfTokenFromCookie();
    if (cookieValue) {
      return cookieValue;
    }
  }

  // If no token found and we have retries left, wait and try again
  if (retries > 0) {
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    return getCsrfToken(retries - 1, retryDelay);
  }

  // Last resort: fetch from API
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      throw new Error(`Failed to get CSRF token: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('[CSRF] Failed to fetch token:', error);
    throw new Error('Failed to obtain CSRF token. Please refresh the page.');
  }
}

/**
 * Reads CSRF token from cookie with proper URL decoding
 * This fixes the encoding issue that causes "Invalid CSRF token" errors
 *
 * @returns string | null - The decoded token or null if not found
 */
function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  try {
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find((cookie) =>
      cookie.trim().startsWith('csrf-token=')
    );

    if (csrfCookie) {
      const encodedValue = csrfCookie.split('=')[1];
      // Properly decode the cookie value (handles base64url encoding)
      try {
        return decodeURIComponent(encodedValue);
      } catch {
        // If decoding fails, return as-is (might already be decoded)
        return encodedValue;
      }
    }
  } catch (error) {
    console.error('[CSRF] Error reading cookie:', error);
  }

  return null;
}

/**
 * Adds CSRF token to fetch headers
 *
 * @param headers - Existing headers object
 * @returns Promise<HeadersInit> - Headers with CSRF token added
 * @throws Error if token cannot be obtained
 */
export async function addCsrfTokenToHeaders(headers: HeadersInit = {}): Promise<HeadersInit> {
  const token = await getCsrfToken();

  return {
    ...headers,
    'X-CSRF-Token': token,
  };
}

/**
 * Makes a fetch request with CSRF token automatically included
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await addCsrfTokenToHeaders(options.headers);

  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include', // Ensure cookies are sent
  });
}

/**
 * Helper for common admin API operations with CSRF protection
 * Use this instead of raw fetch() to automatically include CSRF tokens
 */
export const adminApi = {
  /**
   * GET request (no CSRF needed)
   */
  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, {
      ...options,
      method: 'GET',
      credentials: 'include',
    });
  },

  /**
   * POST request with CSRF token
   */
  async post(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    const headers = await addCsrfTokenToHeaders({
      'Content-Type': 'application/json',
      ...options.headers,
    });

    return fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });
  },

  /**
   * PUT request with CSRF token
   */
  async put(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    const headers = await addCsrfTokenToHeaders({
      'Content-Type': 'application/json',
      ...options.headers,
    });

    return fetch(url, {
      ...options,
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });
  },

  /**
   * PATCH request with CSRF token
   */
  async patch(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    const headers = await addCsrfTokenToHeaders({
      'Content-Type': 'application/json',
      ...options.headers,
    });

    return fetch(url, {
      ...options,
      method: 'PATCH',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });
  },

  /**
   * DELETE request with CSRF token
   */
  async delete(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = await addCsrfTokenToHeaders(options.headers);

    return fetch(url, {
      ...options,
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
  },
};

