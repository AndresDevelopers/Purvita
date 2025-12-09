import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import { createReferralModule } from '@/modules/referrals/factories/referral-module';
import { createProductModule } from '@/modules/products/factories/product-module';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { affiliateSecurityMonitor } from '@/lib/security/affiliate-security-monitor';
import { validateAffiliateCustomization } from '@/lib/security/url-sanitizer';
import { AffiliatePageClient } from './affiliate-page-client';
import type { Product } from '@/lib/models/definitions';
import {
  generateAffiliateMetadata,
  generateAffiliateSchema,
  generateProductListSchema,
  generateAffiliateTrackingMetadata
} from '@/lib/seo/affiliate-metadata';

interface Props {
  params: Promise<{ referralCode: string; lang: Locale }>;
}

/**
 * Detects visitor's country from Cloudflare headers or authenticated user profile
 */
async function detectVisitorCountry(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  try {
    // First, try to get country from Cloudflare headers (if behind Cloudflare)
    const headersList = await headers();
    const cfCountry = headersList.get('CF-IPCountry');

    if (cfCountry && /^[A-Z]{2}$/.test(cfCountry.toUpperCase())) {
      if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Page] Detected country from Cloudflare:', cfCountry);
      return cfCountry.toUpperCase();
    }

    // If user is authenticated, try to get country from their profile
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.country && /^[A-Z]{2}$/.test(profile.country.toUpperCase())) {
        if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Page] Detected country from user profile:', profile.country);
        return profile.country.toUpperCase();
      }
    }

    if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Page] Could not detect visitor country');
    return null;
  } catch (error) {
    console.error('[Affiliate Page] Error detecting visitor country:', error);
    return null;
  }
}

/**
 * Filters products based on visitor's country
 * Only shows products that are available in the visitor's country
 */
function filterProductsByCountry(products: Product[], visitorCountry: string | null): Product[] {
  const filtered = products.filter((product) => {
    // If cart_visibility_countries is not configured (null/undefined), show to everyone (legacy behavior)
    if (product.cart_visibility_countries === null || product.cart_visibility_countries === undefined) {
      return true;
    }

    // If cart_visibility_countries is an empty array, cart is DISABLED for all countries - hide product
    if (Array.isArray(product.cart_visibility_countries) && product.cart_visibility_countries.length === 0) {
      return false;
    }

    // Product HAS country restrictions - if we can't detect country, hide product
    if (!visitorCountry) {
      return false;
    }

    // Normalize visitor country for comparison
    const normalizedVisitorCountry = visitorCountry.trim().toUpperCase();

    // Check if visitor's country is in the allowed list (normalized)
    const allowedCountries = product.cart_visibility_countries
      .map(code => typeof code === 'string' ? code.trim().toUpperCase() : '')
      .filter(code => /^[A-Z]{2}$/.test(code));

    return allowedCountries.includes(normalizedVisitorCountry);
  });

  return filtered;
}

async function getAffiliateData(referralCode: string) {
  const { service } = createReferralModule();

  try {
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
      // ✅ SECURITY: Log attempt to access inactive affiliate store
      const headersList = await headers();
      await affiliateSecurityMonitor.logInactiveStoreAccess(referralCode, {
        ipAddress: headersList.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
        userAgent: headersList.get('user-agent') || undefined,
        pathname: `/affiliate/${referralCode}`,
      });
      return null;
    }

    // Get sponsor profile with creation date
    // Note: affiliate_store_* columns don't exist yet in the database schema
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .eq('id', sponsor.sponsorId)
      .single();

    // Get all products
    const { repository: productRepo } = createProductModule();
    const allProducts = await productRepo.list();

    // Detect visitor's country (use regular client for visitor detection)
    const supabase = await createClient();
    const visitorCountry = await detectVisitorCountry(supabase);

    // Filter products by country availability
    const products = filterProductsByCountry(allProducts, visitorCountry);

    // Prepare customization data
    // Note: affiliate_store_* columns don't exist yet, using defaults
    const rawCustomization = {
      storeTitle: null,
      bannerUrl: null,
      logoUrl: null,
    };

    // ✅ SECURITY: Validate and sanitize customization URLs
    const validationResult = validateAffiliateCustomization(rawCustomization);
    if (!validationResult.isValid) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Affiliate Page] Customization validation errors:', validationResult.errors);
      }
    }

    return {
      sponsor: {
        id: sponsor.sponsorId,
        name: sponsor.sponsorName,
        // ✅ SECURITY FIX #5: Do NOT expose sponsorEmail (removed from ReferralResolutionResult)
        // Email addresses should not be exposed to prevent phishing, user enumeration, and privacy violations
        referralCode: sponsor.referralCode || sponsor.normalizedCode,
        createdAt: profileData?.created_at || null,
      },
      customization: validationResult.sanitized,
      seoKeywords: null, // affiliate_seo_keywords column doesn't exist yet
      storeSlug: null, // affiliate_store_slug column doesn't exist yet
      products,
    };
  } catch (error) {
    console.error('[Affiliate Page] Error loading affiliate data:', error);
    return null;
  }
}

/**
 * Generate SEO metadata for affiliate store
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { referralCode, lang } = await params;

  const affiliateData = await getAffiliateData(referralCode);

  if (!affiliateData) {
    return {
      title: 'Affiliate Store Not Found | PurVita',
      description: 'The affiliate store you are looking for could not be found.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  // ✅ SECURITY & TRACKING: Generate metadata with tracking information
  return generateAffiliateMetadata({
    referralCode,
    sponsorName: affiliateData.sponsor.name,
    storeTitle: affiliateData.customization.storeTitle,
    bannerUrl: affiliateData.customization.bannerUrl,
    logoUrl: affiliateData.customization.logoUrl,
    productCount: affiliateData.products.length,
    lang,
    storeSlug: affiliateData.storeSlug || undefined,
    sponsorId: affiliateData.sponsor.id,
    createdAt: affiliateData.sponsor.createdAt || undefined,
    seoKeywords: affiliateData.seoKeywords || undefined,
  });
}

export default async function AffiliatePageServer({ params }: Props) {
  const { referralCode, lang } = await params;
  const dict = await getLocalizedDictionary(lang);

  const affiliateData = await getAffiliateData(referralCode);

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

  // Generate Schema.org structured data
  const storeSchema = generateAffiliateSchema({
    referralCode,
    sponsorName: affiliateData.sponsor.name,
    storeTitle: affiliateData.customization.storeTitle,
    bannerUrl: affiliateData.customization.bannerUrl,
    logoUrl: affiliateData.customization.logoUrl,
    productCount: affiliateData.products.length,
    lang,
    storeSlug: affiliateData.storeSlug || undefined,
  });

  const productListSchema = generateProductListSchema(
    {
      referralCode,
      sponsorName: affiliateData.sponsor.name,
      storeTitle: affiliateData.customization.storeTitle,
      bannerUrl: affiliateData.customization.bannerUrl,
      logoUrl: affiliateData.customization.logoUrl,
      productCount: affiliateData.products.length,
      lang,
      storeSlug: affiliateData.storeSlug || undefined,
    },
    affiliateData.products.map(p => ({
      id: p.id || '',
      name: p.name || '',
      description: p.description || null,
      price: p.price || 0,
      imageUrl: p.images?.[0]?.url || null,
    }))
  );

  // ✅ SECURITY & TRACKING: Generate tracking metadata
  const trackingMetadata = generateAffiliateTrackingMetadata({
    referralCode,
    sponsorName: affiliateData.sponsor.name,
    storeTitle: affiliateData.customization.storeTitle,
    bannerUrl: affiliateData.customization.bannerUrl,
    logoUrl: affiliateData.customization.logoUrl,
    productCount: affiliateData.products.length,
    lang,
    storeSlug: affiliateData.storeSlug || undefined,
    sponsorId: affiliateData.sponsor.id,
    createdAt: affiliateData.sponsor.createdAt || undefined,
  });

  return (
    <>
      {/* Schema.org JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productListSchema) }}
      />

      {/* ✅ SECURITY & TRACKING: Add tracking metadata to page */}
      <div
        className="hidden"
        {...trackingMetadata}
        aria-hidden="true"
      />

      <AffiliatePageClient
        lang={lang}
        sponsor={safeSponsor}
        products={affiliateData.products}
        dictionary={dict}
        customization={affiliateData.customization}
      />
    </>
  );
}

