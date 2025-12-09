/**
 * Affiliate Access Validation
 * 
 * Server-side validation for affiliate store ownership and subscription status.
 * This ensures that only authorized users can access owner-specific features.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { validateReferralCode } from '@/lib/security/validate-referral-code';

export interface AffiliateAccessResult {
  isOwner: boolean;
  hasActiveSubscription: boolean;
  isWaitlisted: boolean;
  profileId: string | null;
  referralCode: string | null;
}

/**
 * Validates if a user has access to affiliate store features
 * 
 * @param userId - The user ID to validate
 * @param referralCode - The referral code of the affiliate store
 * @returns Access validation result
 */
export async function validateAffiliateAccess(
  userId: string,
  referralCode: string
): Promise<AffiliateAccessResult> {
  // Validate and sanitize referral code
  const sanitizedCode = validateReferralCode(referralCode);
  
  const supabase = getAdminClient();
  
  // Get profile by referral code (case-insensitive)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, referral_code')
    .ilike('referral_code', sanitizedCode)
    .single();
  
  if (profileError || !profile) {
    return {
      isOwner: false,
      hasActiveSubscription: false,
      isWaitlisted: false,
      profileId: null,
      referralCode: null,
    };
  }

  // Check if user is the owner
  const isOwner = profile.id === userId;

  if (!isOwner) {
    return {
      isOwner: false,
      hasActiveSubscription: false,
      isWaitlisted: false,
      profileId: profile.id,
      referralCode: profile.referral_code,
    };
  }

  // ✅ SECURITY FIX: Check subscription status AND waitlist status for owner
  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('status, waitlisted')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    console.error('[validateAffiliateAccess] Error fetching subscription:', subscriptionError);
  }

  const hasActiveSubscription = subscription?.status === 'active';
  const isWaitlisted = subscription?.waitlisted === true;

  return {
    isOwner: true,
    hasActiveSubscription,
    isWaitlisted,
    profileId: profile.id,
    referralCode: profile.referral_code,
  };
}

/**
 * Validates affiliate access and throws if unauthorized
 * 
 * @param userId - The user ID to validate
 * @param referralCode - The referral code of the affiliate store
 * @param requireSubscription - Whether to require an active subscription
 * @throws Error if user is not authorized
 */
export async function requireAffiliateAccess(
  userId: string,
  referralCode: string,
  requireSubscription: boolean = true
): Promise<void> {
  const access = await validateAffiliateAccess(userId, referralCode);

  if (!access.isOwner) {
    throw new Error('Unauthorized: You do not own this affiliate store');
  }

  // ✅ SECURITY FIX: Block waitlisted users from accessing affiliate features
  if (access.isWaitlisted) {
    throw new Error('Access restricted: Your account is currently on the waitlist');
  }

  if (requireSubscription && !access.hasActiveSubscription) {
    throw new Error('Subscription required: You need an active subscription to access this feature');
  }
}

