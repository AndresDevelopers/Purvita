/**
 * Fetch with Timeout Utility
 * 
 * Provides a wrapper around fetch() that adds timeout functionality
 * to prevent hanging requests and improve security.
 * 
 * @see docs/security-audit-2025.md
 */

/**
 * Fetch with automatic timeout
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 10000ms = 10s)
 * @returns Promise<Response>
 * @throws Error if request times out
 * 
 * @example
 * ```typescript
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ foo: 'bar' }),
 * }, 5000); // 5 second timeout
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Check if error was due to timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }

    throw error;
  }
}

/**
 * Validate Content-Type header
 * 
 * @param request - Request object
 * @param expectedType - Expected content type (default: 'application/json')
 * @returns true if valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (!validateContentType(request)) {
 *   return NextResponse.json({ error: 'Invalid Content-Type' }, { status: 415 });
 * }
 * ```
 */
export function validateContentType(
  request: Request,
  expectedType: string = 'application/json'
): boolean {
  const contentType = request.headers.get('content-type');
  
  if (!contentType) {
    return false;
  }

  return contentType.includes(expectedType);
}

/**
 * Create a Response for invalid Content-Type
 * 
 * @param expected - Expected content type
 * @returns Response with 415 status
 */
export function createInvalidContentTypeResponse(expected: string = 'application/json'): Response {
  return new Response(
    JSON.stringify({
      error: 'Unsupported Media Type',
      message: `Expected Content-Type: ${expected}`,
    }),
    {
      status: 415,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

