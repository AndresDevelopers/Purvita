import { notFound } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import { createReferralModule } from '@/modules/referrals/factories/referral-module';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { getAdminClient } from '@/lib/supabase/admin';
import { AffiliateCheckoutClient } from './affiliate-checkout-client';

interface Props {
  params: Promise<{ referralCode: string; lang: Locale }>;
}

/**
 * Validates affiliate and loads necessary data for checkout
 */
async function getAffiliateCheckoutData(referralCode: string) {
  try {
    const { service } = createReferralModule();

    // Resolve the sponsor using the referral code
    const sponsor = await service.resolveSponsor(referralCode);

    // Check if the sponsor has an active subscription
    // Use admin client to bypass RLS - this is a public check (anyone can see if store is active)
    const supabaseAdmin = getAdminClient();
    const subscriptionRepo = new SubscriptionRepository(supabaseAdmin);
    const subscription = await subscriptionRepo.findByUserId(sponsor.sponsorId);

    // Verify active subscription
    const hasActiveSubscription = subscription?.status === 'active';

    if (!hasActiveSubscription) {
      return null;
    }

    // Get sponsor profile with customization data
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('affiliate_store_title, affiliate_store_banner_url, affiliate_store_logo_url')
      .eq('id', sponsor.sponsorId)
      .single();

    return {
      sponsor: {
        id: sponsor.sponsorId,
        name: sponsor.sponsorName || 'Affiliate',
        // ✅ SECURITY FIX #5: Do NOT expose sponsorEmail (removed from ReferralResolutionResult)
        // Email addresses should not be exposed to prevent phishing, user enumeration, and privacy violations
        referralCode: sponsor.referralCode || sponsor.normalizedCode,
      },
      customization: {
        storeTitle: profileData?.affiliate_store_title || null,
        bannerUrl: profileData?.affiliate_store_banner_url || null,
        logoUrl: profileData?.affiliate_store_logo_url || null,
      },
    };
  } catch (error) {
    console.error('[Affiliate Checkout] Error loading affiliate data:', error);
    return null;
  }
}

export default async function AffiliateCheckoutPage({ params }: Props) {
  const { referralCode, lang } = await params;
  const dict = await getLocalizedDictionary(lang);

  const affiliateData = await getAffiliateCheckoutData(referralCode);

  if (!affiliateData) {
    notFound();
  }

  // Filter sensitive sponsor data before sending to client
  const safeSponsor = {
    id: affiliateData.sponsor.id,
    name: affiliateData.sponsor.name,
    referralCode: affiliateData.sponsor.referralCode,
    // ❌ DO NOT expose email to client
  };

  return (
    <AffiliateCheckoutClient
      lang={lang}
      sponsor={safeSponsor}
      dictionary={dict}
      customization={affiliateData.customization}
      referralCode={referralCode}
    />
  );
}

