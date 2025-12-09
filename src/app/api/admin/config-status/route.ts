import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { emailProviderStatus } from '@/lib/services/email-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/config-status
 * Check configuration status of all services (Supabase, Email, Payment Gateways)
 * Requires: view_dashboard permission (minimal permission for viewing dashboard)
 * 
 * This endpoint is specifically designed for the Configuration Status widget
 * and doesn't require specific permissions like manage_users or manage_payments
 */
export const GET = withAdminPermission('view_dashboard', async () => {
  try {
    const supabase = await createClient();

    // Check Supabase connectivity
    let supabaseConfigured = false;
    try {
      // Simple query to verify database connectivity
      // We use a basic query that doesn't require specific permissions
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      supabaseConfigured = !error;
    } catch {
      supabaseConfigured = false;
    }

    // Check Email configuration
    let emailConfigured = false;
    try {
      const emailStatus = emailProviderStatus();
      emailConfigured =
        emailStatus.hasEmailProvider === true &&
        emailStatus.fromAddressConfigured === true &&
        emailStatus.fromNameConfigured === true;
    } catch {
      emailConfigured = false;
    }

    // Check Payment Gateways configuration
    let stripeConfigured = false;
    let stripeMode: 'test' | 'production' | null = null;
    let stripeActive = false;
    let paypalConfigured = false;
    let paypalMode: 'test' | 'production' | null = null;
    let paypalActive = false;

    // Check Stripe credentials from environment variables
    const stripeHasTestCredentials = Boolean(
      process.env.STRIPE_TEST_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY
    );
    const stripeHasProductionCredentials = Boolean(
      process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    );

    // Check PayPal credentials from environment variables
    const paypalHasTestCredentials = Boolean(
      process.env.PAYPAL_TEST_CLIENT_ID &&
      process.env.PAYPAL_TEST_CLIENT_SECRET
    );
    const paypalHasProductionCredentials = Boolean(
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET
    );

    // Determine configured status and mode based on available credentials
    if (stripeHasTestCredentials) {
      stripeConfigured = true;
      stripeMode = 'test';
    } else if (stripeHasProductionCredentials) {
      stripeConfigured = true;
      stripeMode = 'production';
    }

    if (paypalHasTestCredentials) {
      paypalConfigured = true;
      paypalMode = 'test';
    } else if (paypalHasProductionCredentials) {
      paypalConfigured = true;
      paypalMode = 'production';
    }

    try {
      // Get all gateways from database to check if they are active
      const { data: gateways } = await supabase
        .from('payment_gateways')
        .select('provider, is_active, mode');

      const allGateways = gateways ?? [];

      // Check Stripe active status from DB
      const stripeGateway = allGateways.find(g => g.provider === 'stripe');
      if (stripeGateway) {
        stripeActive = stripeGateway.is_active === true;
        // If DB has a mode set, use it to determine which credentials to check
        const dbMode = stripeGateway.mode || 'production';
        if (dbMode === 'test' && stripeHasTestCredentials) {
          stripeMode = 'test';
        } else if (dbMode === 'production' && stripeHasProductionCredentials) {
          stripeMode = 'production';
        }
      }

      // Check PayPal active status from DB
      const paypalGateway = allGateways.find(g => g.provider === 'paypal');
      if (paypalGateway) {
        paypalActive = paypalGateway.is_active === true;
        // If DB has a mode set, use it to determine which credentials to check
        const dbMode = paypalGateway.mode || 'production';
        if (dbMode === 'test' && paypalHasTestCredentials) {
          paypalMode = 'test';
        } else if (dbMode === 'production' && paypalHasProductionCredentials) {
          paypalMode = 'production';
        }
      }
    } catch (error) {
      console.error('Error checking payment gateway configuration:', error);
      // If DB query fails, we already have configured/mode from env vars
      // Active status remains false (unknown)
    }

    return NextResponse.json({
      supabase: supabaseConfigured,
      email: emailConfigured,
      stripe: {
        configured: stripeConfigured,
        mode: stripeMode,
        active: stripeActive,
      },
      paypal: {
        configured: paypalConfigured,
        mode: paypalMode,
        active: paypalActive,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error checking config status:', error);
    return NextResponse.json(
      {
        supabase: false,
        email: false,
        stripe: { configured: false, mode: null },
        paypal: { configured: false, mode: null },
      },
      { status: 200 } // Return 200 with default values instead of error
    );
  }
});

