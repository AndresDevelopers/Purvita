/**
 * Example API Route with Rate Limiting
 * 
 * This is an example of how to implement rate limiting in a Next.js API route
 * using Upstash Redis. You can copy this pattern to your own API routes.
 * 
 * Features:
 * - Rate limiting using Redis (with in-memory fallback)
 * - Proper HTTP headers for rate limit status
 * - Error handling
 * - TypeScript types
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitHeaders, RateLimitPresets } from '@/lib/utils/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Get identifier (IP address or user ID)
    const forwarded = request.headers.get('x-forwarded-for');
    const identifier = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';

    // Apply rate limit (60 requests per minute)
    const rateLimitResult = await rateLimit(identifier, RateLimitPresets.standard);

    // Check if rate limit exceeded
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'You have exceeded the rate limit. Please try again later.',
          retryAfter: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
            'Retry-After': (rateLimitResult.reset - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }

    // Your API logic here
    const data = {
      message: 'Success! This endpoint is rate limited.',
      timestamp: new Date().toISOString(),
    };

    // Return response with rate limit headers
    return NextResponse.json(data, {
      status: 200,
      headers: getRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    console.error('[API] Error in example-with-rate-limit:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get identifier
    const forwarded = request.headers.get('x-forwarded-for');
    const identifier = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';

    // Apply stricter rate limit for POST requests (5 requests per minute)
    const rateLimitResult = await rateLimit(identifier, RateLimitPresets.strict);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'You have exceeded the rate limit for POST requests.',
          retryAfter: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
            'Retry-After': (rateLimitResult.reset - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();

    // Your API logic here
    const data = {
      message: 'POST request successful!',
      received: body,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(data, {
      status: 200,
      headers: getRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    console.error('[API] Error in example-with-rate-limit POST:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

