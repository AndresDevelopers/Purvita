'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
// import Image from 'next/image'; // Unused
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator as _Separator } from '@/components/ui/separator';
import ProductCard from '@/app/components/product-card';
import type { Locale } from '@/i18n/config';
import type { AppDictionary } from '@/i18n/dictionaries';
import type { Product } from '@/lib/models/definitions';
import { useCart } from '@/contexts/cart-context';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useCurrencyForCountry } from '@/contexts/app-settings-context';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import { useCurrentUserCountry } from '@/modules/profile/hooks/use-current-user-country';
import {
  CheckCircle2,
  Headphones,
  Package,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import type { ProductReviewDisplay } from '@/modules/products/types/product-review';
import { ProductImageGallery } from './product-image-gallery';
import { computeRelativeTimeAgo, normalizeMemberReviewResponse } from '@/modules/products/utils/review-utils';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';
import { PersonalizedRecommendations } from '@/components/products/personalized-recommendations';

interface ProductDetailCopy {
  tagline: string;
  heroSupporting: string;
  quickHighlights: readonly string[];
  usage: readonly string[];
  ingredients: readonly string[];
  wellness: readonly string[];
  insights: readonly string[];
  rating: {
    average: number;
    count: number;
  };
  reviews: readonly ProductReviewDisplay[];
}

const _FALLBACK_IMAGE = '/placeholder-image.svg';

function resolveArray(value: any): string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function resolveDictionaryReviews(value: any): ProductReviewDisplay[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const item = entry as Partial<ProductReviewDisplay>;

      return {
        id: item.id ?? Math.random().toString(36).slice(2),
        author: item.author ?? 'Customer',
        timeAgo: item.timeAgo ?? undefined,
        rating: typeof item.rating === 'number' ? item.rating : 5,
        comment: item.comment ?? '',
        createdAt: null,
        avatarUrl: item.avatarUrl,
        source: item.source,
      };
    })
    .filter((entry) => entry.comment.trim().length > 0);
}

export function resolveProductCopy(dictionary: AppDictionary, product: Product, lang: Locale): ProductDetailCopy {
  const details = dictionary.productDetails ?? {} as any as any as any;
  const defaults = (details.defaults ?? {}) as Partial<ProductDetailCopy>;
  const productOverrides =
    details.products && typeof details.products === 'object'
      ? (details.products as Record<string, unknown>)
      : {};
  const overrides = (productOverrides[product.slug] ?? {}) as Partial<ProductDetailCopy>;

  const experience = product.experience ?? {};
  const localizedExperience = experience.locales?.[lang];
  const fallbackExperience = lang === 'es' ? experience.locales?.en : experience.locales?.es;

  const getString = (
    experienceValue: string | undefined,
    overrideValue: any,
    fallbackValue: any,
  ): string => {
    if (typeof experienceValue === 'string' && experienceValue.trim().length > 0) {
      return experienceValue.trim();
    }

    if (typeof overrideValue === 'string' && overrideValue.trim().length > 0) {
      return overrideValue.trim();
    }

    if (typeof fallbackValue === 'string' && fallbackValue.trim().length > 0) {
      return fallbackValue.trim();
    }

    return '';
  };

  const getArray = (
    experienceValue: string[] | undefined,
    overrideValue: any,
    fallbackValue: any,
  ): string[] => {
    const experienceArray = Array.isArray(experienceValue)
      ? experienceValue.filter((item) => typeof item === 'string' && item.trim().length > 0)
      : [];

    if (experienceArray.length > 0) {
      return experienceArray;
    }

    const overrideArray = resolveArray(overrideValue);
    if (overrideArray.length > 0) {
      return overrideArray;
    }

    const fallbackArray = resolveArray(fallbackValue);
    return fallbackArray;
  };

  const ratingSource = experience.rating ?? overrides.rating ?? defaults.rating ?? { average: 4.8, count: 0 };

  const normalizedRating = {
    average:
      typeof ratingSource?.average === 'number'
        ? Math.min(Math.max(ratingSource.average, 0), 5)
        : 4.8,
    count: typeof ratingSource?.count === 'number' ? Math.max(ratingSource.count, 0) : 0,
  };

  const curatedReviews = (experience.reviews ?? [])
    .filter((review) => {
      if (!review.locale) {
        return true;
      }

      return review.locale === lang;
    })
    .map((review) => {
      return {
        id: review.id,
        author: review.author,
        avatarUrl: review.avatarUrl,
        createdAt: review.createdAt ?? null,
        timeAgo: review.timeAgo ?? computeRelativeTimeAgo(review.createdAt ?? null, lang),
        rating: typeof review.rating === 'number' ? review.rating : 5,
        comment: review.comment,
        source: review.source,
      } satisfies ProductReviewDisplay;
    })
    .filter((review) => review.comment.trim().length > 0);

  const resolvedReviews =
    curatedReviews.length > 0
      ? curatedReviews
      : resolveDictionaryReviews(overrides.reviews).length > 0
        ? resolveDictionaryReviews(overrides.reviews)
        : resolveDictionaryReviews(defaults.reviews);

  return {
    tagline: getString(
      localizedExperience?.tagline ?? fallbackExperience?.tagline,
      overrides.tagline,
      details.fallbackTagline ?? defaults.tagline,
    ),
    heroSupporting: getString(
      localizedExperience?.heroSupporting ?? fallbackExperience?.heroSupporting,
      overrides.heroSupporting,
      details.fallbackHeroSupporting ?? defaults.heroSupporting,
    ),
    quickHighlights: getArray(
      localizedExperience?.quickHighlights ?? fallbackExperience?.quickHighlights,
      overrides.quickHighlights,
      defaults.quickHighlights,
    ),
    usage: getArray(
      localizedExperience?.usage ?? fallbackExperience?.usage,
      overrides.usage,
      defaults.usage,
    ),
    ingredients: getArray(
      localizedExperience?.ingredients ?? fallbackExperience?.ingredients,
      overrides.ingredients,
      defaults.ingredients,
    ),
    wellness: getArray(
      localizedExperience?.wellness ?? fallbackExperience?.wellness,
      overrides.wellness,
      defaults.wellness,
    ),
    insights: getArray(
      localizedExperience?.insights ?? fallbackExperience?.insights,
      overrides.insights,
      defaults.insights,
    ),
    rating: normalizedRating,
    reviews: resolvedReviews,
  };
}

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
  lang: Locale;
}

const STAR_COUNT = 5;

const formatTemplate = (template: string | undefined, value: string): string | undefined => {
  if (!template) {
    return undefined;
  }

  if (!template.includes('{{count}}')) {
    return template;
  }

  return template.replace('{{count}}', value);
};

export function ProductDetailClient({ product, relatedProducts, lang }: ProductDetailClientProps) {
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
  const resolveCurrency = useCurrencyForCountry();
  const [isAdding, setIsAdding] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US'),
    [lang],
  );

  const copy = useMemo(() => resolveProductCopy(dict, product, lang), [dict, lang, product]);

  const pricing = useMemo(() => getDiscountedUnitPrice(product), [product]);
  const hasDiscount = pricing.discountAmount > 0;
  const currencyCode = useMemo(() => resolveCurrency(userCountry), [resolveCurrency, userCountry]);
  const priceFormatter = useMemo(() => {
    const locale = lang === 'es' ? 'es' : 'en';
    const buildFormatter = (currency: string) => {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          currencyDisplay: 'symbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } catch {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'USD',
          currencyDisplay: 'symbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
    };

    return buildFormatter(currencyCode);
  }, [currencyCode, lang]);
  const formattedFinalPrice = useMemo(
    () => priceFormatter.format(pricing.finalUnitPrice),
    [priceFormatter, pricing.finalUnitPrice],
  );
  const formattedUnitPrice = useMemo(
    () => priceFormatter.format(pricing.unitPrice),
    [priceFormatter, pricing.unitPrice],
  );
  const isCountryAllowed = useMemo(() => {
    // If cart_visibility_countries is not configured (null/undefined), allow all countries (legacy behavior)
    if (product.cart_visibility_countries === null || product.cart_visibility_countries === undefined) {
      return true;
    }

    // If cart_visibility_countries is an empty array, cart is DISABLED for all countries
    if (Array.isArray(product.cart_visibility_countries) && product.cart_visibility_countries.length === 0) {
      return false;
    }

    // Product HAS country restrictions configured by admin
    if (!userCountry) {
      return false;
    }

    // Normalize user country for comparison
    const normalizedUserCountry = userCountry.trim().toUpperCase();
    
    // Normalize product's allowed countries and check if user's country is included
    const normalizedAllowedCountries = product.cart_visibility_countries
      .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : ''))
      .filter((code) => /^[A-Z]{2}$/.test(code));

    return normalizedAllowedCountries.includes(normalizedUserCountry);
  }, [product.cart_visibility_countries, userCountry]);

  const checkingAvailabilityLabel =
    dict.products.checkingAvailability ?? 'Checking availability…';
  const unavailableLabel =
    dict.products.unavailableInCountry ?? 'This product is not available in your country yet.';
  const canAddToCart =
    isAuthenticated && !isLoading && !isCountryLoading && isCountryAllowed;

  // Filter related products by country availability
  const filteredRelatedProducts = useMemo(() => {
    return relatedProducts.filter((relatedProduct) => {
      // If cart_visibility_countries is not configured (null/undefined), allow all countries
      if (relatedProduct.cart_visibility_countries === null || relatedProduct.cart_visibility_countries === undefined) {
        return true;
      }

      // If cart_visibility_countries is an empty array, cart is DISABLED for all countries - hide
      if (Array.isArray(relatedProduct.cart_visibility_countries) && relatedProduct.cart_visibility_countries.length === 0) {
        return false;
      }

      // Product HAS country restrictions configured
      if (!userCountry || isCountryLoading) {
        return false;
      }

      // Normalize user country for comparison
      const normalizedUserCountry = userCountry.trim().toUpperCase();

      // Check if user's country is in the allowed list (normalized)
      const allowedCountries = relatedProduct.cart_visibility_countries
        .map(code => typeof code === 'string' ? code.trim().toUpperCase() : '')
        .filter(code => /^[A-Z]{2}$/.test(code));

      return allowedCountries.includes(normalizedUserCountry);
    });
  }, [relatedProducts, userCountry, isCountryLoading]);

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
            .map((entry: any) => normalizeMemberReviewResponse(entry, lang))
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

  // Helper function to remove Tawk.to completely
  const removeTawkTo = useCallback(() => {
    // Remove all Tawk.to scripts
    document.querySelectorAll('script[src*="tawk.to"]').forEach((el) => el.remove());

    // Remove Tawk.to widget container and iframes
    document.querySelectorAll('[id*="tawk"], [class*="tawk"], iframe[src*="tawk"]').forEach((el) => el.remove());

    // Also remove by common Tawk.to element IDs
    ['tawk-tooltip-container', 'tawk-bubble-container', 'tawk-notification-container'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // Remove Tawk.to global variables
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.Tawk_API?.hideWidget) {
        try { win.Tawk_API.hideWidget(); } catch { /* ignore */ }
      }
      delete win.Tawk_API;
      delete win.Tawk_LoadStart;
    }
  }, []);

  // Track pathname to detect navigation away from products
  const pathname = usePathname();
  const isProductsPage = pathname?.includes('/products');

  useEffect(() => {
    // Only load Tawk.to on products pages
    if (!isProductsPage) {
      removeTawkTo();
      return;
    }

    // Check if Tawk.to is already loaded
    if ((window as any).Tawk_API) {
      try {
        (window as any).Tawk_API.showWidget?.();
      } catch { /* ignore */ }
      return;
    }

    // Load Tawk.to script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://embed.tawk.to/68e8fef849de86194fcd0a31/default';
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(script, firstScript);

    // Cleanup on unmount
    return () => {
      removeTawkTo();
    };
  }, [isProductsPage, removeTawkTo]);

  const addToCartButtonLabel = useMemo(() => {
    if (isAdding) {
      return dict.products.addingToCart ?? dict.products.addToCart;
    }

    return dict.products.addToCart;
  }, [dict.products.addToCart, dict.products.addingToCart, isAdding]);


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
    return formatTemplate(dict.productDetails?.ratingCountLabel, formatted) ?? formatted;
  }, [aggregatedRating.count, dict.productDetails?.ratingCountLabel, numberFormatter]);


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

  const stockQuantity = product.stock_quantity ?? 0;
  const stockLabel = useMemo(() => {
    if (stockQuantity <= 0) {
      return undefined;
    }

    if (stockQuantity <= 6) {
      const template = dict.productDetails?.stockLowLabel;
      const formatted = numberFormatter.format(stockQuantity);
      return template ? template.replace('{{count}}', formatted) : undefined;
    }

    return dict.productDetails?.stockStatusLabel;
  }, [dict.productDetails?.stockLowLabel, dict.productDetails?.stockStatusLabel, numberFormatter, stockQuantity]);

  const handleAddToCart = useCallback(() => {
    if (!product || !isAuthenticated || isAdding || !isCountryAllowed) {
      return;
    }

    setIsAdding(true);
    addItem(product);
    const template = dict.products.addedToCartDescription ?? '';
    const description = template
      ? template.includes('{{product}}')
        ? template.replace('{{product}}', product.name)
        : `${template} ${product.name}`
      : product.name;

    toast({
      title: dict.products.addedToCartTitle ?? dict.products.addToCart,
      description,
      duration: 2500,
    });
    navigator.vibrate?.(12);
    router.push(`/${lang}/cart`);
    setTimeout(() => setIsAdding(false), 360);
  }, [
    addItem,
    dict.products.addToCart,
    dict.products.addedToCartDescription,
    dict.products.addedToCartTitle,
    isAdding,
    isAuthenticated,
    isCountryAllowed,
    lang,
    product,
    router,
    toast,
  ]);

  const handleShare = useCallback(async () => {
    if (isSharing) {
      return;
    }

    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return;
    }

    if (!navigator.share) {
      toast({
        title: dict.productDetails?.shareLabel ?? 'Share',
        description: window.location.href,
      });
      return;
    }

    try {
      setIsSharing(true);
      await navigator.share({
        title: product.name,
        text: copy.tagline,
        url: window.location.href,
      });
      navigator.vibrate?.(8);
    } catch (error) {
      console.error('ProductDetailClient: share failed', error);
    } finally {
      setIsSharing(false);
    }
  }, [copy.tagline, dict.productDetails?.shareLabel, isSharing, product.name, toast]);

  const infoItems = useMemo(
    () => [
      {
        id: 'shipping',
        label: dict.productDetails?.shippingLabel,
        value: dict.productDetails?.shippingValue,
        icon: Package,
      },
      {
        id: 'guarantee',
        label: dict.productDetails?.guaranteeLabel,
        value: dict.productDetails?.guaranteeValue,
        icon: ShieldCheck,
      },
      {
        id: 'support',
        label: dict.productDetails?.supportLabel,
        value: dict.productDetails?.supportValue,
        icon: Headphones,
      },
    ].filter((item) => item.label && item.value),
    [dict.productDetails?.guaranteeLabel, dict.productDetails?.guaranteeValue, dict.productDetails?.shippingLabel, dict.productDetails?.shippingValue, dict.productDetails?.supportLabel, dict.productDetails?.supportValue],
  );

  return (
    <div
      className="container mx-auto max-w-6xl px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <ProductImageGallery images={product.images} productName={product.name} />

        <div className="flex flex-col justify-center gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="font-headline text-3xl font-bold leading-tight text-gray-900 dark:text-emerald-50 sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-lg text-muted-foreground sm:text-xl dark:text-emerald-100/80">{copy.tagline}</p>
            <p className="text-base text-muted-foreground dark:text-emerald-100/70">{copy.heroSupporting}</p>
          </div>

          <div className="rounded-3xl border border-emerald-200/70 bg-white/80 p-6 shadow-md backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/60">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                  {dict.productDetails?.priceLabel ?? 'Price'}
                </p>
                <div className="flex flex-col">
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    {formattedFinalPrice}
                  </p>
                  {hasDiscount ? (
                    <span className="text-sm text-muted-foreground line-through dark:text-emerald-200/70">
                      {formattedUnitPrice}
                    </span>
                  ) : null}
                  {hasDiscount && pricing.discount?.label ? (
                    <span className="mt-1 inline-flex w-max rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-200">
                      {pricing.discount.label}
                    </span>
                  ) : null}
                </div>
                {stockLabel ? (
                  <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-300">{stockLabel}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {canAddToCart ? (
                  <Button
                    size="lg"
                    className="flex-1 min-w-[160px] gap-2 bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-700 focus-visible:ring-emerald-600"
                    onClick={handleAddToCart}
                    disabled={!canAddToCart || isAdding}
                  >
                    {addToCartButtonLabel}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1 min-w-[160px] gap-2"
                  onClick={handleShare}
                  disabled={isSharing}
                >
                  <Share2 className="h-4 w-4" />
                  {dict.productDetails?.shareLabel ?? 'Share'}
                </Button>
              </div>
            </div>
            {isAuthenticated && !isLoading ? (
              isCountryLoading ? (
                <p className="mt-4 text-sm text-muted-foreground dark:text-emerald-100/70">
                  {checkingAvailabilityLabel}
                </p>
              ) : !isCountryAllowed ? (
                <p className="mt-4 rounded-lg border border-dashed border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                  {unavailableLabel}
                </p>
              ) : null
            ) : null}
            {!isLoading && !isAuthenticated ? (
              <p className="mt-4 text-sm text-muted-foreground dark:text-emerald-100/70">
                {dict.products.loginToAddToCart}{' '}
                <Link href={`/${lang}/auth/login`} className="font-medium text-primary hover:underline">
                  {dict.products.loginAction}
                </Link>
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {infoItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.id} className="h-full rounded-2xl border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/40 dark:bg-emerald-950/50">
                  <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                      {item.label}
                    </p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 text-sm text-muted-foreground dark:text-emerald-100/80">
                    {item.value}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mt-16 grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
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
              {Array.from({ length: STAR_COUNT }).map((_, index) => (
                <Star
                  key={index}
                  className={`h-5 w-5 ${index + 1 <= Math.round(ratingValue) ? 'fill-emerald-500 text-emerald-500' : 'text-emerald-200 dark:text-emerald-800'}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8">
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

          <div className="grid gap-8 lg:grid-cols-2">
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
          </div>
        </div>
      </section>

      <section className="mt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {dict.productDetails?.reviewListTitle ?? 'Recent reviews'}
            </h2>
            {dict.productDetails?.ratingDescription ? (
              <p className="text-sm text-muted-foreground dark:text-emerald-200/80">
                {dict.productDetails.ratingDescription}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/${lang}/products/${product.slug}/reviews`}
              className="w-fit gap-2 px-0 text-emerald-700 hover:text-emerald-800 dark:text-emerald-200"
            >
              {dict.productDetails?.reviewCta ?? 'Read all reviews'}
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
                    {Array.from({ length: STAR_COUNT }).map((_, index) => (
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

      {filteredRelatedProducts.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-8 font-headline text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {dict.productDetails?.relatedProducts}
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredRelatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Personalized Recommendations - Based on user purchase history */}
      {isAuthenticated && (
        <PersonalizedRecommendations
          lang={lang}
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
