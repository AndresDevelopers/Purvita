import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checks if a user has an active subscription
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @returns true if user has active subscription, false otherwise
 */
export async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return subscription?.status === 'active';
  } catch (error) {
    console.error('[hasActiveSubscription] Error checking subscription:', error);
    return false;
  }
}

/**
 * Checks if the current user is the owner of an affiliate store by referral code
 * @param supabase - Supabase client instance
 * @param userId - Current user ID
 * @param referralCode - Referral code to check
 * @returns true if user owns the store, false otherwise
 */
export async function isAffiliateStoreOwner(
  supabase: SupabaseClient,
  userId: string,
  referralCode: string
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, referral_code')
      .ilike('referral_code', referralCode)
      .single();

    return profile?.id === userId;
  } catch (error) {
    console.error('[isAffiliateStoreOwner] Error checking ownership:', error);
    return false;
  }
}

