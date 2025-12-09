import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { SubscriptionRenewalService } from '@/modules/multilevel/services/subscription-renewal-service';
import { SubscriptionEventBus } from '@/modules/multilevel/observers/subscription-event-bus';

/**
 * GET /api/cron/subscription-renewals
 * 
 * Cron job endpoint for processing automatic subscription renewals.
 * 
 * This endpoint should be called daily by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * 
 * Security:
 * - Requires CRON_SECRET environment variable to match the Authorization header
 * - Only processes subscriptions that are within 1 day of expiry
 * 
 * Example Vercel Cron configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/subscription-renewals",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 * 
 * Example manual call:
 * curl -X GET https://your-domain.com/api/cron/subscription-renewals \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[SubscriptionRenewalCron] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SubscriptionRenewalCron] Starting subscription renewal cron job...');

    // Create admin client for database access
    const adminClient = getAdminClient();
    const bus = new SubscriptionEventBus();
    const renewalService = new SubscriptionRenewalService(adminClient, bus);

    // Process renewals (1 day before expiry)
    const summary = await renewalService.processRenewals(1);

    console.log('[SubscriptionRenewalCron] Renewal cron job completed:', summary);

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: summary.totalProcessed,
        successful: summary.successful,
        failed: summary.failed,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[SubscriptionRenewalCron] Error in renewal cron job:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false, 
        error: message,
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/subscription-renewals
 * 
 * Alternative endpoint for POST requests (some cron services prefer POST)
 */
export async function POST(req: NextRequest) {
  return GET(req);
}

