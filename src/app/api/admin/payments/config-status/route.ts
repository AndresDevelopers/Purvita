import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payments/config-status
 * Check payment gateway configuration status from environment variables
 * Requires: manage_payments permission
 */
export const GET = withAdminPermission('manage_payments', async () => {
  try {
    const supabase = await createClient();

    // Get all gateways from database to know which mode they're in
    // We check all gateways (not just active ones) to show their configuration status
    const { data: gateways } = await supabase
      .from('payment_gateways')
      .select('provider, is_active, mode');

    const allGateways = gateways || [];

    // Check Stripe configuration
    const stripeGateway = allGateways.find(g => g.provider === 'stripe');
    const stripeMode = stripeGateway?.mode || 'production';
    let stripeConfigured = false;

    if (stripeGateway) {
      if (stripeMode === 'test') {
        stripeConfigured = Boolean(
          (process.env.STRIPE_TEST_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
          (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
        );
      } else {
        stripeConfigured = Boolean(
          (process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
          process.env.STRIPE_SECRET_KEY
        );
      }
    }

    // Check PayPal configuration
    const paypalGateway = allGateways.find(g => g.provider === 'paypal');
    const paypalMode = paypalGateway?.mode || 'production';
    let paypalConfigured = false;

    if (paypalGateway) {
      if (paypalMode === 'test') {
        paypalConfigured = Boolean(
          process.env.PAYPAL_TEST_CLIENT_ID &&
          process.env.PAYPAL_TEST_CLIENT_SECRET
        );
      } else {
        paypalConfigured = Boolean(
          process.env.PAYPAL_CLIENT_ID &&
          process.env.PAYPAL_CLIENT_SECRET
        );
      }
    }

    return NextResponse.json({
      stripe: {
        configured: stripeConfigured,
        mode: stripeGateway ? stripeMode : null,
      },
      paypal: {
        configured: paypalConfigured,
        mode: paypalGateway ? paypalMode : null,
      },
    });
  } catch (error) {
    console.error('Failed to check payment config status:', error);
    return NextResponse.json({ error: 'Failed to check configuration' }, { status: 500 });
  }
})
