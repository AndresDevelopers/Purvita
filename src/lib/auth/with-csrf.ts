/**
 * CSRF Protection Wrapper for API Routes
 * 
 * Provides a convenient way to add CSRF protection to API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

type RouteHandler<T = any> = (
  request: NextRequest,
  context?: T
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route handler with CSRF protection
 * 
 * @example
 * export const POST = withCsrf(async (request) => {
 *   // Your handler code
 * });
 */
export function withCsrf<T = any>(handler: RouteHandler<T>): RouteHandler<T> {
  return async (request: NextRequest, context?: T) => {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    // Call the original handler
    return handler(request, context);
  };
}

/**
 * Wraps multiple HTTP method handlers with CSRF protection
 * 
 * @example
 * export const { POST, PUT, DELETE } = withCsrfMethods({
 *   POST: async (request) => { ... },
 *   PUT: async (request) => { ... },
 *   DELETE: async (request) => { ... }
 * });
 */
export function withCsrfMethods<T = any>(handlers: {
  POST?: RouteHandler<T>;
  PUT?: RouteHandler<T>;
  DELETE?: RouteHandler<T>;
  PATCH?: RouteHandler<T>;
}) {
  const wrapped: Record<string, RouteHandler<T>> = {};

  for (const [method, handler] of Object.entries(handlers)) {
    if (handler) {
      wrapped[method] = withCsrf(handler);
    }
  }

  return wrapped as typeof handlers;
}
