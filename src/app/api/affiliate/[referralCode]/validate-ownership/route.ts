import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/with-auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/affiliate/[referralCode]/validate-ownership
 *
 * Validates that the authenticated user is the owner of the affiliate page
 * with the given referral code AND has an active subscription (MLM or Affiliate).
 *
 * Both subscription types (MLM and Affiliate) can:
 * - Customize their store appearance (banner, logo, title)
 * - View store analytics (visits, conversions, revenue)
 *
 * Security:
 * - Requires authentication
 * - Validates ownership of referral code
 * - Requires active subscription of any type (mlm or affiliate)
 * - Prevents unauthorized access to affiliate analytics/settings/customization
 */
export const GET = withAuth(async (request: AuthenticatedRequest, context) => {
  try {
    // In Next.js 15, params can be a Promise
    const params = await Promise.resolve(context.params);
    const referralCode = params?.referralCode as string;
    const userId = request.user.id;

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Get the user's referral code from their profile (case-insensitive)
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Ownership Validation] Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to validate ownership' },
        { status: 500 }
      );
    }

    // Check if the user's referral code matches the one in the URL (case-insensitive)
    if (profile?.referral_code?.toLowerCase() !== referralCode.toLowerCase()) {
      console.warn('[SECURITY] Ownership validation failed', {
        userId,
        requestedCode: referralCode,
        actualCode: profile?.referral_code,
      });

      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You are not the owner of this affiliate page',
          valid: false,
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Verify active subscription (MLM or Affiliate - both can customize store)
    // Use the same supabase client that already has the user session from withAuth
    // RLS policy allows users to read their own subscriptions (auth.uid() = user_id)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status, subscription_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('[Ownership Validation] Error checking subscription:', subError);
      return NextResponse.json(
        { error: 'Error verifying subscription status', details: subError.message },
        { status: 500 }
      );
    }

    if (!subscription) {
      console.warn('[SECURITY] Owner has no active subscription', {
        userId,
        referralCode,
      });

      return NextResponse.json(
        {
          error: 'Subscription required',
          message: 'Active subscription required to access store customization and analytics',
          valid: false,
          requiresSubscription: true,
        },
        { status: 403 }
      );
    }

    // Validation successful - user is owner AND has active subscription (MLM or Affiliate)
    return NextResponse.json({
      valid: true,
      message: 'Ownership and subscription validated successfully',
      isOwner: true,
      hasActiveSubscription: true,
      subscriptionType: subscription.subscription_type, // 'mlm' or 'affiliate'
    });
  } catch (error) {
    console.error('[Ownership Validation] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
