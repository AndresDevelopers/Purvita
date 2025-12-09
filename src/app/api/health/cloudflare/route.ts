import { NextResponse } from 'next/server';

/**
 * Cloudflare Health Check Endpoint
 * 
 * This endpoint is specifically designed for Cloudflare Health Checks API.
 * It bypasses rate limiting to ensure reliable monitoring.
 * 
 * Configuration in Cloudflare:
 * 1. Go to Cloudflare Dashboard > Load Balancing > Health Checks
 * 2. Create a new health check with:
 *    - Type: HTTPS
 *    - Host: your-domain.com
 *    - Path: /api/health/cloudflare
 *    - Port: 443
 *    - Interval: 30 seconds (default)
 *    - Timeout: 5 seconds
 *    - Retries: 2
 * 
 * @swagger
 * /api/health/cloudflare:
 *   get:
 *     summary: Cloudflare Health Check endpoint
 *     description: Lightweight health check endpoint for Cloudflare Health Checks. No rate limiting applied.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Application is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: PūrVita
 *       503:
 *         description: Service unavailable
 */
export async function GET(request: Request) {
  try {
    // Verify request is from Cloudflare (optional but recommended)
    const userAgent = request.headers.get('user-agent') || '';
    const cfRay = request.headers.get('cf-ray');
    
    // Log health check request
    console.log('[Cloudflare Health Check]', {
      timestamp: new Date().toISOString(),
      userAgent,
      cfRay,
      url: request.url,
    });

    const response = NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_NAME || 'PūrVita',
      environment: process.env.NODE_ENV || 'production',
    });

    // Prevent caching of health check responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');

    return response;
  } catch (error) {
    console.error('[Cloudflare Health Check] Error:', error);
    
    const errorResponse = NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );

    // Prevent caching of error responses
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    
    return errorResponse;
  }
}

