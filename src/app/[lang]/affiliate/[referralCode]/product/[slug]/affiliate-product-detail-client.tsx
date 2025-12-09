'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import ProductCard from '@/app/components/product-card';
import type { Locale } from '@/i18n/config';
import type { Product } from '@/lib/models/definitions';
import { useCart } from '@/contexts/cart-context';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useCurrencyForCountry } from '@/contexts/app-settings-context';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import { useCurrentUserCountry } from '@/modules/profile/hooks/use-current-user-country';
import { useReferralTracking } from '@/contexts/referral-tracking-context';
import {
  ArrowLeft,
  CheckCircle2,
  Headphones,
  MessageSquarePlus,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  UserPlus,
} from 'lucide-react';
import { ProductImageGallery } from '@/app/[lang]/products/[slug]/product-image-gallery';
import { resolveProductCopy } from '@/app/[lang]/products/[slug]/product-detail-client';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';
import type { ProductReviewDisplay } from '@/modules/products/types/product-review';
import { normalizeMemberReviewResponse } from '@/modules/products/utils/review-utils';
import { PersonalizedRecommendations } from '@/components/affiliate/personalized-recommendations';

interface AffiliateProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
  lang: Locale;
  affiliateCode: string;
  sponsorId: string;
}

export function AffiliateProductDetailClient({
  product,
  relatedProducts,
  lang,
  affiliateCode,
  sponsorId,
}: AffiliateProductDetailClientProps) {
  const dict = useAppDictionary();
  const { addItem } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const supabaseUser = useSupabaseUser();
  const { user, isAuthenticated, isLoading } = supabaseUser;
  const { country: userCountry, isLoading: isCountryLoading } = useCurrentUserCountry({
    userId: user?.id ?? null,
    isAuthenticated,
    isAuthLoading: isLoading,
  });
  const { referralCode: _trackedReferralCode, affiliateId: trackedAffiliateId } = useReferralTracking();
  const resolveCurrency = useCurrencyForCountry();
  const [isAdding, setIsAdding] = useState(false);
  const [userReferredBy, setUserReferredBy] = useState<string | null>(null);

  const copy = useMemo(() => resolveProductCopy(dict, product, lang), [dict, product, lang]);
  const pricing = useMemo(() => getDiscountedUnitPrice(product), [product]);
  const hasDiscount = pricing.discountAmount > 0;

  const currencyCode = useMemo(() => resolveCurrency(userCountry), [resolveCurrency, userCountry]);
  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(lang === 'es' ? 'es' : 'en', {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return new Intl.NumberFormat(lang === 'es' ? 'es' : 'en', {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }, [currencyCode, lang]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US'),
    [lang],
  );

  // Load member reviews
  const [memberReviews, setMemberReviews] = useState<ProductReviewDisplay[]>([]);
  const [isLoadingMemberReviews, setIsLoadingMemberReviews] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadReviews = async () => {
      try {
        setIsLoadingMemberReviews(true);
        const response = await fetch(`/api/products/${product.slug}/reviews`, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Failed to fetch reviews: ${response.status}`);
        }

        const payload = await response.json();
        if (!isActive) {
          return;
        }

        const reviews = Array.isArray(payload?.reviews) ? payload.reviews : [];
        const normalized = reviews
          .map((entry: unknown) => normalizeMemberReviewResponse(entry, lang))
          .filter(
            (review: ProductReviewDisplay | null | undefined): review is ProductReviewDisplay =>
              Boolean(review),
          );

        setMemberReviews(normalized);
      } catch (error) {
        if (isActive) {
          console.error('Failed to load member reviews', error);
          setMemberReviews([]);
        }
      } finally {
        if (isActive) {
          setIsLoadingMemberReviews(false);
        }
      }
    };

    setMemberReviews([]);
    loadReviews();

    return () => {
      isActive = false;
    };
  }, [lang, product.slug]);

  const formattedFinalPrice = useMemo(
    () => currencyFormatter.format(pricing.finalUnitPrice),
    [currencyFormatter, pricing.finalUnitPrice],
  );
  const formattedUnitPrice = useMemo(
    () => currencyFormatter.format(pricing.unitPrice),
    [currencyFormatter, pricing.unitPrice],
  );

  const allowedCountrySet = useMemo(() => {
    if (!Array.isArray(product.cart_visibility_countries)) {
      return new Set<string>();
    }
    const codes = product.cart_visibility_countries
      .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : ''))
      .filter((code) => /^[A-Z]{2}$/.test(code));
    return new Set(codes);
  }, [product.cart_visibility_countries]);

  const isCountryAllowed = useMemo(() => {
    // If no countries are configured, allow all countries
    if (allowedCountrySet.size === 0) return true;
    if (!userCountry) return false;
    // Normalize user country for comparison
    const normalizedUserCountry = userCountry.trim().toUpperCase();
    return allowedCountrySet.has(normalizedUserCountry);
  }, [allowedCountrySet, userCountry]);

  // Filter related products by country availability
  const filteredRelatedProducts = useMemo(() => {
    if (!userCountry || isCountryLoading) {
      return relatedProducts;
    }

    // Normalize user country for comparison
    const normalizedUserCountry = userCountry.trim().toUpperCase();

    return relatedProducts.filter((relatedProduct) => {
      // If product has no country restrictions, show it (allow all countries)
      if (!Array.isArray(relatedProduct.cart_visibility_countries) || relatedProduct.cart_visibility_countries.length === 0) {
        return true;
      }

      // Check if user's country is in the allowed list (normalized)
      const allowedCountries = relatedProduct.cart_visibility_countries
        .map(code => typeof code === 'string' ? code.trim().toUpperCase() : '')
        .filter(code => /^[A-Z]{2}$/.test(code));

      return allowedCountries.includes(normalizedUserCountry);
    });
  }, [relatedProducts, userCountry, isCountryLoading]);

  // Calculate aggregated rating
  const memberReviewStats = useMemo(() => {
    if (memberReviews.length === 0) {
      return { count: 0, sum: 0 };
    }

    return memberReviews.reduce<{ count: number; sum: number }>(
      (acc: { count: number; sum: number }, review: ProductReviewDisplay) => {
        if (typeof review.rating === 'number' && Number.isFinite(review.rating) && review.rating > 0) {
          acc.count += 1;
          acc.sum += review.rating;
        }
        return acc;
      },
      { count: 0, sum: 0 },
    );
  }, [memberReviews]);

  const aggregatedRating = useMemo(() => {
    const baseAverage =
      typeof copy.rating.average === 'number' && !Number.isNaN(copy.rating.average)
        ? copy.rating.average
        : 0;
    const baseCount = Math.max(copy.rating.count ?? 0, 0);

    const totalCount = baseCount + memberReviewStats.count;

    if (totalCount === 0) {
      return {
        average: Math.min(Math.max(baseAverage, 0), 5),
        count: 0,
      };
    }

    const weightedSum = baseAverage * baseCount + memberReviewStats.sum;
    const average = weightedSum / totalCount;

    return {
      average: Number.isFinite(average) ? Math.min(Math.max(average, 0), 5) : 0,
      count: totalCount,
    };
  }, [copy.rating.average, copy.rating.count, memberReviewStats]);

  const ratingValue = useMemo(() => aggregatedRating.average, [aggregatedRating.average]);

  const ratingSummary = useMemo(() => {
    const summaryTemplate = dict.productDetails?.ratingSummaryLabel;
    if (summaryTemplate) {
      return summaryTemplate.replace('{{rating}}', ratingValue.toFixed(1));
    }

    return `${ratingValue.toFixed(1)} / 5`;
  }, [dict.productDetails?.ratingSummaryLabel, ratingValue]);

  const ratingCount = useMemo(() => {
    const formatted = numberFormatter.format(Math.max(aggregatedRating.count ?? 0, 0));
    const template = dict.productDetails?.ratingCountLabel;
    if (!template) {
      return formatted;
    }
    if (!template.includes('{{count}}')) {
      return template;
    }
    return template.replace('{{count}}', formatted);
  }, [aggregatedRating.count, dict.productDetails?.ratingCountLabel, numberFormatter]);

  // Combine and sort reviews
  const combinedReviews = useMemo(() => {
    const merged = [...memberReviews, ...copy.reviews];

    const entries = merged.map((review, index) => {
      const timestamp = review.createdAt ? Date.parse(review.createdAt) : Number.NaN;
      return {
        review,
        index,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
      };
    });

    entries.sort((a, b) => {
      if (a.timestamp !== null && b.timestamp !== null) {
        return b.timestamp - a.timestamp;
      }
      if (a.timestamp !== null) {
        return -1;
      }
      if (b.timestamp !== null) {
        return 1;
      }
      return a.index - b.index;
    });

    const seen = new Set<string>();
    const result: ProductReviewDisplay[] = [];

    for (const entry of entries) {
      const key = entry.review.id;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(entry.review);
    }

    return result;
  }, [copy.reviews, memberReviews]);

  const recentReviews = useMemo(() => combinedReviews.slice(0, 4), [combinedReviews]);
  const showReviewSkeleton = isLoadingMemberReviews && combinedReviews.length === 0;

  // Check if user was referred by this affiliate
  useEffect(() => {
    const checkUserReferral = async () => {
      if (!isAuthenticated || !user?.id) {
        setUserReferredBy(null);
        return;
      }

      try {
        // ✅ SECURITY: Use secure endpoint that only returns referral status
        const response = await fetch(`/api/profile/referral-status?affiliateId=${encodeURIComponent(sponsorId)}`);
        if (response.ok) {
          const data = await response.json();
          // Store the sponsorId if user is referred by this affiliate
          setUserReferredBy(data.isReferredBy ? sponsorId : null);
        } else {
          setUserReferredBy(null);
        }
      } catch (error) {
        console.error("Error checking user referral:", error);
        setUserReferredBy(null);
      }
    };

    checkUserReferral();
  }, [isAuthenticated, user?.id, sponsorId]);

  // Determine if user can purchase
  const canPurchase = useMemo(() => {
    // Not authenticated: can't purchase
    if (!isAuthenticated) return false;
    
    // Loading states
    if (isLoading || isCountryLoading) return false;
    
    // Country not allowed
    if (!isCountryAllowed) return false;
    
    // User must be referred by this affiliate OR have the affiliate code tracked
    const wasReferredByThisAffiliate = userReferredBy === sponsorId;
    const hasAffiliateTracked = trackedAffiliateId === sponsorId;
    
    return wasReferredByThisAffiliate || hasAffiliateTracked;
  }, [isAuthenticated, isLoading, isCountryLoading, isCountryAllowed, userReferredBy, sponsorId, trackedAffiliateId]);

  const handleAddToCart = () => {
    if (!canPurchase || isAdding) return;

    setIsAdding(true);
    addItem(product);

    // Store the affiliate page URL as the return URL for after payment
    try {
      // Store the affiliate main page URL (not the product detail page)
      const affiliatePageUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/${lang}/affiliate/${affiliateCode}`
        : '';
      if (affiliatePageUrl) {
        sessionStorage.setItem('payment_return_url', affiliatePageUrl);
        if (process.env.NODE_ENV !== 'production') console.log('[AffiliateProduct] Stored return URL:', affiliatePageUrl);
      }
    } catch (error) {
      console.error('[AffiliateProduct] Failed to store return URL:', error);
    }

    toast({
      title: dict.products.addedToCartTitle ?? dict.products.addToCart,
      description: dict.products.addedToCartDescription?.replace('{{product}}', product.name) || product.name,
      duration: 2500,
    });
    navigator.vibrate?.(12);
    // Redirect to affiliate cart, not main cart
    router.push(`/${lang}/affiliate/${affiliateCode}/cart`);
    setTimeout(() => setIsAdding(false), 400);
  };

  const handleRegister = () => {
    router.push(`/${lang}/affiliate/${affiliateCode}/register`);
  };

  const handleBackToStore = () => {
    router.push(`/${lang}/affiliate/${affiliateCode}`);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-16 pt-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleBackToStore}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {dict.productDetails?.reviewBackToProduct || 'Back to Store'}
      </Button>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Product Images - Visible to Everyone */}
        <ProductImageGallery images={product.images} productName={product.name} />

        <div className="flex flex-col justify-center gap-6">
          {/* Product Info - Visible to Everyone */}
          <div className="flex flex-col gap-3">
            <h1 className="font-headline text-3xl font-bold leading-tight text-gray-900 dark:text-emerald-50 sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-lg text-muted-foreground sm:text-xl dark:text-emerald-100/80">{copy.tagline}</p>
            <p className="text-base text-muted-foreground dark:text-emerald-100/70">{copy.heroSupporting}</p>
          </div>

          <Separator />

          {/* Price - Visible to Everyone */}
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-bold text-primary dark:text-emerald-300">
              {formattedFinalPrice}
            </p>
            {hasDiscount && (
              <>
                <p className="text-xl text-muted-foreground line-through">
                  {formattedUnitPrice}
                </p>
                {pricing.discount?.label && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {pricing.discount.label}
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Purchase Section */}
          <div className="space-y-4">
            {canPurchase ? (
              <Button
                onClick={handleAddToCart}
                disabled={isAdding}
                size="lg"
                className="w-full gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                {isAdding ? (dict.products.addingToCart ?? 'Adding...') : (dict.products.addToCart ?? 'Add to Cart')}
              </Button>
            ) : !isAuthenticated ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6 text-center">
                  <UserPlus className="mx-auto mb-3 h-12 w-12 text-primary" />
                  <h3 className="mb-2 text-lg font-semibold">
                    {dict.affiliate?.registerToPurchase || 'Register to Purchase'}
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {dict.affiliate?.registerToPurchaseDescription || 
                      'Create an account through this affiliate page to purchase products and earn rewards.'}
                  </p>
                  <Button onClick={handleRegister} size="lg" className="w-full gap-2">
                    <UserPlus className="h-5 w-5" />
                    {dict.affiliate?.registerButton || 'Register Now'}
                  </Button>
                </CardContent>
              </Card>
            ) : !isCountryAllowed ? (
              <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
                {dict.products.unavailableInCountry ?? 'This product is not available in your country yet.'}
              </div>
            ) : (
              <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-6 text-center">
                  <h3 className="mb-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
                    {dict.affiliate?.notRegisteredThroughAffiliate || 'Not Registered Through This Affiliate'}
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {dict.affiliate?.notRegisteredThroughAffiliateDescription || 
                      'To purchase from this store, you need to register through this affiliate page.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">{dict.productDetails?.guaranteeLabel ?? 'Secure'}</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">{dict.productDetails?.shippingLabel ?? 'Fast Ship'}</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Headphones className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">{dict.productDetails?.supportLabel ?? 'Support'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Sections */}
      <section className="mt-16 grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
        {/* Customer Reviews Card */}
        <Card className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <Star className="h-5 w-5 fill-emerald-500 text-emerald-500" />
              {dict.productDetails?.ratingTitle ?? 'Customer reviews'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground dark:text-emerald-100/80">
            <div>
              <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{ratingSummary}</p>
              <p className="text-sm text-muted-foreground dark:text-emerald-200/80">{ratingCount}</p>
              {dict.productDetails?.ratingDescription ? (
                <p className="mt-2 text-sm text-muted-foreground dark:text-emerald-200/80">
                  {dict.productDetails.ratingDescription}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-emerald-500">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={`h-5 w-5 ${index + 1 <= Math.round(ratingValue) ? 'fill-emerald-500 text-emerald-500' : 'text-emerald-200 dark:text-emerald-800'}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8">
          {/* Quick Highlights */}
          {copy.quickHighlights.length > 0 && (
            <Card className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50">
              <CardHeader>
                <CardTitle className="text-emerald-900 dark:text-emerald-100">
                  {dict.productDetails?.quickHighlightsTitle ?? "Why you'll love it"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground dark:text-emerald-100/80">
                {copy.quickHighlights.map((highlight) => (
                  <div key={highlight} className="flex items-start gap-2 rounded-2xl bg-emerald-50/80 p-3 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <Sparkles className="mt-0.5 h-4 w-4" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* How to Use & Daily Ritual Tips */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* How to Use */}
            {copy.usage.length > 0 && (
              <Card className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50">
                <CardHeader>
                  <CardTitle className="text-emerald-900 dark:text-emerald-100">
                    {dict.productDetails?.usageTitle ?? 'How to use'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground dark:text-emerald-100/80">
                  <ol className="flex flex-col gap-2">
                    {copy.usage.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {dict.productDetails?.usageReminder ? (
                    <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
                      {dict.productDetails.usageReminder}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Daily Ritual Tips */}
            {copy.insights.length > 0 && (
              <Card className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50">
                <CardHeader>
                  <CardTitle className="text-emerald-900 dark:text-emerald-100">
                    {dict.productDetails?.insightsTitle ?? 'Daily ritual tips'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground dark:text-emerald-100/80">
                  {copy.insights.map((insight) => (
                    <div key={insight} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Recent Reviews Section */}
      <section className="mt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mb-2 font-headline text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {dict.productDetails?.reviewListTitle ?? 'Reseñas recientes'}
            </h2>
            {dict.productDetails?.ratingDescription ? (
              <p className="text-sm text-muted-foreground dark:text-emerald-200/80">
                {dict.productDetails.ratingDescription}
              </p>
            ) : null}
          </div>
          <Button variant="outline" asChild className="gap-2">
            <Link href={`/${lang}/affiliate/${affiliateCode}/product/${product.slug}/reviews`}>
              <MessageSquarePlus className="h-4 w-4" />
              Escribir reseña
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {recentReviews.length > 0 ? (
            recentReviews.map((review) => (
              <Card
                key={review.id}
                className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border border-emerald-100 bg-white dark:border-emerald-900/60 dark:bg-emerald-900/40">
                        {review.avatarUrl ? (
                          <AvatarImage src={review.avatarUrl} alt={`${review.author} avatar`} />
                        ) : null}
                        <AvatarFallback className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                          {getInitials(review.author)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">{review.author}</p>
                        {review.timeAgo ? (
                          <p className="text-xs text-muted-foreground dark:text-emerald-200/80">{review.timeAgo}</p>
                        ) : null}
                      </div>
                    </div>
                    {review.source === 'member' && dict.productDetails?.ratingVerifiedLabel ? (
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200"
                      >
                        {dict.productDetails.ratingVerifiedLabel}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${index + 1 <= review.rating ? 'fill-emerald-500 text-emerald-500' : 'text-emerald-200 dark:text-emerald-800'}`}
                      />
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground dark:text-emerald-100/80">
                  {review.comment}
                </CardContent>
              </Card>
            ))
          ) : showReviewSkeleton ? (
            Array.from({ length: 2 }).map((_, index) => (
              <Card
                key={`review-skeleton-${index}`}
                className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50"
                aria-hidden
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-emerald-700/30 bg-emerald-50/40 p-6 text-center text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/40 dark:text-emerald-100/70">
              {dict.productDetails?.reviewEmptyState ?? 'There are no reviews yet. Be the first to share your experience.'}
            </div>
          )}
        </div>
      </section>

      {/* Related Products */}
      {filteredRelatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-8 font-headline text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {dict.productDetails?.relatedProducts ?? 'También te puede interesar'}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRelatedProducts.slice(0, 3).map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.id}
                product={relatedProduct}
                lang={lang}
                variant="affiliate"
                affiliateCode={affiliateCode}
              />
            ))}
          </div>
        </section>
      )}

      {/* Personalized Recommendations - Based on user purchase history */}
      {isAuthenticated && (
        <PersonalizedRecommendations
          lang={lang}
          affiliateCode={affiliateCode}
          excludeProductIds={[product.id, ...filteredRelatedProducts.map(p => p.id)]}
          limit={4}
        />
      )}
    </div>
  );
}

const getInitials = (name: string): string => {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return 'PV';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};
