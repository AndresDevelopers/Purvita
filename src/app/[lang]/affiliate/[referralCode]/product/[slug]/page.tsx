import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Locale } from '@/i18n/config';
import { logUserAction } from '@/lib/services/audit-log-service';
import type { Product } from '@/lib/models/definitions';
import { createProductModule } from '@/modules/products/factories/product-module';
import { ReferralService } from '@/modules/referrals/services/referral-service';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { AffiliateProductDetailClient } from './affiliate-product-detail-client';

interface Props {
  params: Promise<{ slug: string; lang: Locale; referralCode: string }>;
}

/**
 * Detects visitor's country from Cloudflare headers or authenticated user profile
 */
async function detectVisitorCountry(): Promise<string | null> {
  try {
    // First, try to get country from Cloudflare headers (if behind Cloudflare)
    const headersList = await headers();
    const cfCountry = headersList.get('CF-IPCountry');

    if (cfCountry && /^[A-Z]{2}$/.test(cfCountry.toUpperCase())) {
      if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Product Page] Detected country from Cloudflare:', cfCountry);
      return cfCountry.toUpperCase();
    }

    // If user is authenticated, try to get country from their profile
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country && /^[A-Z]{2}$/.test(profile.country.toUpperCase())) {
        if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Product Page] Detected country from user profile:', profile.country);
        return profile.country.toUpperCase();
      }
    }

    if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Product Page] Could not detect visitor country');
    return null;
  } catch (error) {
    console.error('[Affiliate Product Page] Error detecting visitor country:', error);
    return null;
  }
}

/**
 * Checks if a product is available in the visitor's country
 */
function isProductAvailableInCountry(product: Product, visitorCountry: string | null): boolean {
  // If we can't detect the country, allow access (fallback to client-side check)
  if (!visitorCountry) {
    return true;
  }

  // If product has no country restrictions, it's available (allow all countries)
  if (!Array.isArray(product.cart_visibility_countries) || product.cart_visibility_countries.length === 0) {
    return true;
  }

  // Normalize visitor country for comparison
  const normalizedVisitorCountry = visitorCountry.trim().toUpperCase();

  // Check if visitor's country is in the allowed list (normalized)
  const allowedCountries = product.cart_visibility_countries
    .map(code => typeof code === 'string' ? code.trim().toUpperCase() : '')
    .filter(code => /^[A-Z]{2}$/.test(code));

  return allowedCountries.includes(normalizedVisitorCountry);
}

/**
 * Filters products based on visitor's country
 */
function filterProductsByCountry(products: Product[], visitorCountry: string | null): Product[] {
  // If we can't detect the country, show all products (fallback to client-side filtering)
  if (!visitorCountry) {
    return products;
  }

  return products.filter(product => isProductAvailableInCountry(product, visitorCountry));
}

async function getAffiliateProductData(referralCode: string, slug: string) {
  try {
    const supabaseAdmin = getAdminClient();

    // Create ReferralService with repository
    const { data: _profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, referral_code')
      .limit(1);

    // Simple repository implementation
    const referralRepository = {
      async findByUserId(userId: string) {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email, referral_code')
          .eq('id', userId)
          .maybeSingle();

        if (!data) return null;
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          referralCode: data.referral_code,
        };
      },
      async findByReferralCode(code: string) {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email, referral_code')
          .eq('referral_code', code)
          .maybeSingle();

        if (!data) return null;
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          referralCode: data.referral_code,
        };
      },
    };

    const referralService = new ReferralService(referralRepository);

    // Resolve the referral code to get sponsor info
    const sponsor = await referralService.resolveSponsor(referralCode);

    if (!sponsor) {
      return null;
    }

    // Check if sponsor has active subscription
    const subscriptionRepo = new SubscriptionRepository(supabaseAdmin);
    const subscription = await subscriptionRepo.findByUserId(sponsor.sponsorId);

    if (!subscription || subscription.status !== 'active') {
      return null;
    }

    // Get product
    const { repository: productRepo } = createProductModule();
    const product = await productRepo.getBySlug(slug);

    if (!product) {
      return null;
    }

    // Detect visitor's country
    const visitorCountry = await detectVisitorCountry();

    // Check if the main product is available in visitor's country
    if (!isProductAvailableInCountry(product, visitorCountry)) {
      if (process.env.NODE_ENV !== 'production') console.log(`[Affiliate Product Page] Product ${slug} not available in country ${visitorCountry}`);
      return null;
    }

    // Get related products and filter by country
    const allRelated = await productRepo.listRelated(slug);
    const related = filterProductsByCountry(allRelated, visitorCountry);

    return {
      sponsor: {
        id: sponsor.sponsorId,
        name: sponsor.sponsorName,
        // ✅ SECURITY FIX #5: Do NOT expose sponsorEmail (removed from ReferralResolutionResult)
        // Email addresses should not be exposed to prevent phishing, user enumeration, and privacy violations
        referralCode: sponsor.referralCode || sponsor.normalizedCode,
      },
      product,
      related,
    };
  } catch (error) {
    console.error('[Affiliate Product Page] Error loading data:', error);
    return null;
  }
}

export default async function AffiliateProductDetailPage({ params }: Props) {
  const { slug, lang, referralCode } = await params;
  const data = await getAffiliateProductData(referralCode, slug);
  
  if (!data) {
    notFound();
  }

  try {
    await logUserAction('VIEW_PRODUCT', 'product', data.product.id, {
      productName: data.product.name,
      slug,
      affiliateCode: referralCode,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to record product view audit log', error);
    }
  }

  return (
    <AffiliateProductDetailClient
      product={data.product}
      relatedProducts={data.related}
      lang={lang}
      affiliateCode={referralCode}
      sponsorId={data.sponsor.id}
    />
  );
}

