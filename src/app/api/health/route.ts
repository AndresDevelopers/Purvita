import { NextResponse } from 'next/server';
import { createSecurityModule } from '@/modules/security/factories/security-module';

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the application. Useful for uptime monitoring.
 *     responses:
 *       200:
 *         description: Application is healthy.
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
 */
const { rateLimitService } = createSecurityModule();

export async function GET(request: Request) {
  const guard = await rateLimitService.guard(request, 'api:health:get');

  if (!guard.result.allowed) {
    const response = NextResponse.json(
      rateLimitService.buildErrorPayload(guard.locale),
      { status: 429 },
    );

    return rateLimitService.applyHeaders(response, guard.result);
  }

  const response = NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });

  return rateLimitService.applyHeaders(response, guard.result);
}
