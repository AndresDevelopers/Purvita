"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from 'lucide-react';

import ProductCard from '@/app/components/product-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/contexts/cart-context';
import type { Locale } from '@/i18n/config';
import type { Product } from '@/lib/models/definitions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';
import { useDetectCountry } from '@/modules/profile/hooks/use-detect-country';
import { sanitizeUserInput } from '@/lib/security/frontend-sanitization';

type ProductDictionary = {
  title: string;
  subtitle: string;
  viewDetails: string;
  addToCart: string;
  addingToCart?: string;
  addedToCartTitle?: string;
  addedToCartDescription?: string;
  loginToAddToCart?: string;
  loginAction?: string;
  allProducts: string;
  emptyTitle: string;
  emptyDescription: string;
  errorTitle: string;
  errorDescription: string;
  searchPlaceholder?: string;
  filterTrigger?: string;
  filtersTitle?: string;
  categoriesLabel?: string;
  priceRangeLabel?: string;
  ratingLabel?: string;
  clearFilters?: string;
  resultsCount?: string;
  noResultsTitle?: string;
  noResultsDescription?: string;
  quickView?: string;
  quickViewClose?: string;
  quickViewGoToProduct?: string;
  quickViewDescriptionLabel?: string;
  pullToRefreshHint?: string;
  refreshingLabel?: string;
  loadingMoreLabel?: string;
  activeFiltersLabel?: string;
  categoryPillLabel?: string;
  ratingAriaLabel?: string;
  allRatingsOption?: string;
};

type ProductCatalogExperienceProps = {
  products: Product[];
  lang: Locale;
  dictionary: ProductDictionary;
};

type DerivedProduct = Product & {
  __meta: {
    category: string;
    rating: number;
  };
};

const INITIAL_BATCH_SIZE = 8;
const LOAD_MORE_BATCH = 6;
const RATING_STEPS = [0, 3, 3.5, 4, 4.5];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const deriveCategory = (product: Product): string => {
  const enriched = product as Product & { category?: string; product_category?: string };
  if (typeof enriched.category === 'string' && enriched.category.trim().length > 0) {
    return enriched.category.trim();
  }
  if (typeof enriched.product_category === 'string' && enriched.product_category.trim().length > 0) {
    return enriched.product_category.trim();
  }

  const fallback = product.name?.replace(/^PorVita\s+/i, '').trim();
  if (fallback) {
    return fallback;
  }

  return 'General';
};

const hashRating = (slug: string): number => {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash << 5) - hash + slug.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 21);
  return 3 + normalized / 10;
};

const deriveFromPrice = (price: number) => {
  if (!Number.isFinite(price) || price <= 0) {
    return 3.2;
  }
  if (price >= 90) {
    return 4.7;
  }
  if (price >= 60) {
    return 4.4;
  }
  if (price >= 30) {
    return 4.1;
  }
  return 3.7;
};

const deriveRating = (product: Product): number => {
  const enriched = product as Product & {
    rating?: number;
    average_rating?: number;
    review_score?: number;
  };

  const candidate = [enriched.rating, enriched.average_rating, enriched.review_score].find(
    (value) => typeof value === 'number' && !Number.isNaN(value),
  );

  if (typeof candidate === 'number') {
    return clamp(candidate, 0, 5);
  }

  return clamp(deriveFromPrice(product.price), 0, 5);
};

const enrichProducts = (products: Product[]): DerivedProduct[] =>
  products.map((product) => ({
    ...product,
    __meta: {
      category: deriveCategory(product),
      rating: clamp(hashRating(product.slug ?? product.id) * 0.2 + deriveRating(product) * 0.8, 0, 5),
    },
  }));

const formatPrice = (lang: Locale, value: number) =>
  new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

const useIntersectionObserver = (callback: () => void) => {
  const callbackRef = useRef(callback);
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callbackRef.current();
          }
        });
      },
      {
        rootMargin: '240px 0px',
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);
};

const usePullToRefresh = (onRefresh: () => void) => {
  const callbackRef = useRef(onRefresh);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!element) {
      return;
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0) {
        startYRef.current = null;
        return;
      }

      startYRef.current = event.touches[0]?.clientY ?? null;
      triggeredRef.current = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startYRef.current === null || triggeredRef.current) {
        return;
      }

      const currentY = event.touches[0]?.clientY ?? 0;
      if (currentY - startYRef.current > 80) {
        triggeredRef.current = true;
        callbackRef.current();
      }
    };

    const handleTouchEnd = () => {
      startYRef.current = null;
      triggeredRef.current = false;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [element]);

  return useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);
};

const RatingStars = ({ rating, label }: { rating: number; label?: string }) => {
  const normalized = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = normalized >= index + 1;
        const half = !filled && normalized >= index + 0.5;
        return (
          <Star
            key={`star-${index}`}
            className={cn('h-4 w-4', filled ? 'text-amber-500 fill-amber-400' : half ? 'text-amber-500' : 'text-muted-foreground')}
          />
        );
      })}
      <span className="text-xs font-medium text-muted-foreground">{normalized.toFixed(1)}</span>
    </div>
  );
};

export default function ProductCatalogExperience({ products, lang, dictionary }: ProductCatalogExperienceProps) {
  const router = useRouter();
  const [quickViewProduct, setQuickViewProduct] = useState<DerivedProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const enrichedProducts = useMemo(() => enrichProducts(products), [products]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minimumRating, setMinimumRating] = useState<number>(0);

  // Get user and country information for filtering
  const { user: _user, isAuthenticated, isLoading: authLoading } = useSupabaseUser();
  const { country: userCountryCode } = useDetectCountry({
    autoDetect: true,
  });

  // Helper function to check country availability
  const isProductAvailableInCountry = useCallback((product: DerivedProduct): boolean => {
    // If cart_visibility_countries is not configured (null/undefined), show to everyone
    if (product.cart_visibility_countries === null || product.cart_visibility_countries === undefined) {
      return true;
    }

    // If cart_visibility_countries is an empty array, hide product
    if (Array.isArray(product.cart_visibility_countries) && product.cart_visibility_countries.length === 0) {
      return false;
    }

    // If we can't detect user's country, hide restricted products
    if (!userCountryCode) {
      return false;
    }

    const normalizedUserCountry = userCountryCode.trim().toUpperCase();
    const normalizedAllowedCountries = product.cart_visibility_countries
      .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : ''))
      .filter((code) => /^[A-Z]{2}$/.test(code));

    return normalizedAllowedCountries.includes(normalizedUserCountry);
  }, [userCountryCode]);

  // FIRST: Filter products by country availability
  const countryFilteredProducts = useMemo(() => {
    return enrichedProducts.filter(isProductAvailableInCountry);
  }, [enrichedProducts, isProductAvailableInCountry]);

  // Derive prices ONLY from country-available products
  const prices = useMemo(() => countryFilteredProducts.map((product) => product.price), [countryFilteredProducts]);
  const minPrice = useMemo(() => (prices.length > 0 ? Math.min(...prices) : 0), [prices]);
  const maxPrice = useMemo(() => (prices.length > 0 ? Math.max(...prices) : 100), [prices]);

  // Initialize with a valid range - will be updated by useEffect when real prices are available
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Derive categories ONLY from country-available products
  const categories = useMemo(() => {
    const unique = new Set<string>();
    countryFilteredProducts.forEach((product) => unique.add(product.__meta.category));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, lang));
  }, [countryFilteredProducts, lang]);

  // Set price range when we get valid prices - only once
  const [hasInitializedPriceRange, setHasInitializedPriceRange] = useState(false);

  useEffect(() => {
    // Initialize when we have valid prices and haven't initialized yet
    if (!hasInitializedPriceRange && prices.length > 0) {
      setPriceRange([minPrice, maxPrice]);
      setHasInitializedPriceRange(true);
    }
  }, [minPrice, maxPrice, hasInitializedPriceRange, prices.length]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  // THEN: Apply remaining filters (search, category, price, rating) on country-filtered products
  const filteredProducts = useMemo(() => {
    return countryFilteredProducts.filter((product) => {
      const matchesSearch = normalizedSearchTerm
        ? `${product.name} ${product.description}`.toLowerCase().includes(normalizedSearchTerm)
        : true;

      const matchesCategory = selectedCategory === 'all' || product.__meta.category === selectedCategory;

      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];

      const matchesRating = product.__meta.rating >= minimumRating;

      return matchesSearch && matchesCategory && matchesPrice && matchesRating;
    });
  }, [countryFilteredProducts, normalizedSearchTerm, selectedCategory, priceRange, minimumRating]);

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_BATCH_SIZE, filteredProducts.length));
  }, [filteredProducts.length, searchTerm, selectedCategory, priceRange, minimumRating]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((previous) => {
      if (previous >= filteredProducts.length) {
        return previous;
      }
      return Math.min(previous + LOAD_MORE_BATCH, filteredProducts.length);
    });
  }, [filteredProducts.length]);

  const assignSentinelRef = useIntersectionObserver(handleLoadMore);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    navigator.vibrate?.(20);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, [isRefreshing, router]);

  const assignContainerRef = usePullToRefresh(handleRefresh);

  useEffect(() => {
    if (quickViewProduct) {
      navigator.vibrate?.(15);
    }
  }, [quickViewProduct]);

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

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string }> = [];
    if (selectedCategory !== 'all') {
      filters.push({
        key: 'category',
        label:
          dictionary.categoryPillLabel?.replace('{{category}}', selectedCategory) ?? selectedCategory,
      });
    }
    if (minimumRating > 0) {
      filters.push({
        key: 'rating',
        label: `${dictionary.ratingLabel ?? 'Rating'} ≥ ${minimumRating.toFixed(1)}`,
      });
    }
    if (priceRange[0] !== minPrice || priceRange[1] !== maxPrice) {
      filters.push({
        key: 'price',
        label: `${dictionary.priceRangeLabel ?? 'Price'}: ${formatPrice(lang, priceRange[0])} — ${formatPrice(
          lang,
          priceRange[1],
        )}`,
      });
    }
    return filters;
  }, [selectedCategory, minimumRating, priceRange, dictionary, lang, minPrice, maxPrice]);

  const resetFilters = () => {
    setSelectedCategory('all');
    setMinimumRating(0);
    setPriceRange([minPrice, maxPrice]);
    navigator.vibrate?.(12);
  };

  const dictionaryResultsLabel = dictionary.resultsCount ?? '{{count}} results';
  const resultsLabel = dictionaryResultsLabel.replace('{{count}}', filteredProducts.length.toString());

  const quickViewDictionary = {
    title: dictionary.quickView ?? 'Quick view',
    close: dictionary.quickViewClose ?? 'Close',
    goToProduct: dictionary.quickViewGoToProduct ?? dictionary.viewDetails,
    description: dictionary.quickViewDescriptionLabel ?? 'Product details',
  };

  const FilterControls = (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {dictionary.categoriesLabel ?? 'Category'}
        </Label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={dictionary.allProducts} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{dictionary.allProducts}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {dictionary.priceRangeLabel ?? 'Price range'}
        </Label>
        <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
          <Slider
            min={minPrice}
            max={maxPrice}
            step={1}
            value={priceRange}
            onValueChange={(value) => setPriceRange([value[0] ?? minPrice, value[1] ?? maxPrice])}
          />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {formatPrice(lang, priceRange[0])} — {formatPrice(lang, priceRange[1])}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {dictionary.ratingLabel ?? 'Minimum rating'}
        </Label>
        <Select value={minimumRating.toString()} onValueChange={(value) => setMinimumRating(Number(value))}>
          <SelectTrigger>
            <SelectValue placeholder={dictionary.ratingLabel ?? 'Minimum rating'} />
          </SelectTrigger>
          <SelectContent>
            {RATING_STEPS.map((rating) => (
              <SelectItem key={rating} value={rating.toString()}>
                {rating === 0
                  ? dictionary.allRatingsOption ?? 'All ratings'
                  : `${rating.toFixed(1)} ★`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" onClick={resetFilters} className="gap-2">
        <RefreshCcw className="h-4 w-4" />
        {dictionary.clearFilters ?? 'Reset filters'}
      </Button>
    </div>
  );

  const { addItem } = useCart();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const handleQuickViewAddToCart = useCallback(
    (product: Product) => {
      if (!isAuthenticated || isAdding) {
        return;
      }
      setIsAdding(true);
      addItem(product);
      navigator.vibrate?.(30);
      toast({
        title: dictionary.addedToCartTitle ?? dictionary.addToCart,
        description: dictionary.addedToCartDescription?.replace('{{product}}', product.name) ?? product.name,
        duration: 2500,
      });
      setTimeout(() => setIsAdding(false), 400);
    },
    [addItem, dictionary.addToCart, dictionary.addedToCartDescription, dictionary.addedToCartTitle, isAdding, isAuthenticated, toast],
  );

  return (
    <section
      ref={assignContainerRef}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-900/90 via-emerald-950 to-background px-4 py-10 sm:px-6 lg:px-10"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-600/30 to-transparent" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10">
        <header className="flex flex-col items-center gap-6 text-center text-emerald-50">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            {dictionary.pullToRefreshHint ?? 'Pull down to refresh the latest catalog'}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              {dictionary.title}
            </h1>
            <p className="text-base text-emerald-100/80 sm:text-lg">{dictionary.subtitle}</p>
          </div>
          <p className="rounded-full bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100">
            {resultsLabel}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <aside className="hidden rounded-3xl border border-emerald-800/50 bg-background/95 p-6 shadow-lg shadow-emerald-900/30 backdrop-blur lg:block">
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-lg font-semibold text-emerald-100">
                {dictionary.filtersTitle ?? 'Refine results'}
              </h2>
              <Filter className="h-4 w-4 text-emerald-300" />
            </div>
            {FilterControls}
          </aside>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 rounded-3xl border border-emerald-800/50 bg-background/95 p-4 shadow-lg shadow-emerald-900/30 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      // ✅ SECURITY: Sanitize search input to prevent XSS
                      const sanitized = sanitizeUserInput(event.target.value);
                      setSearchTerm(sanitized);
                    }}
                    placeholder={dictionary.searchPlaceholder ?? 'Search products'}
                    className="h-11 rounded-full bg-muted/60 pl-9"
                  />
                </div>

                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="secondary" className="h-11 w-full gap-2 rounded-full sm:w-auto">
                      <SlidersHorizontal className="h-4 w-4" />
                      {dictionary.filterTrigger ?? 'Filters'}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-3xl">
                    <SheetHeader>
                      <SheetTitle>{dictionary.filtersTitle ?? 'Refine results'}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-6 pb-6">{FilterControls}</div>
                    <SheetFooter>
                      <Button onClick={() => setIsSheetOpen(false)} className="w-full rounded-full">
                        {dictionary.filterTrigger ?? 'Filters'}
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>

              {activeFilters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full bg-emerald-500/20 text-emerald-100">
                    {dictionary.activeFiltersLabel ?? 'Active filters'}
                  </Badge>
                  {activeFilters.map((filter) => (
                    <Badge key={filter.key} variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-50">
                      {filter.label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {isRefreshing ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-700/40 bg-emerald-800/30 p-4 text-emerald-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{dictionary.refreshingLabel ?? 'Refreshing catalog…'}</span>
              </div>
            ) : null}

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-emerald-700/60 bg-emerald-800/20 px-6 py-12 text-center text-emerald-100">
                <Search className="h-10 w-10" />
                <h3 className="text-2xl font-semibold">
                  {dictionary.noResultsTitle ?? 'No products match your filters'}
                </h3>
                <p className="max-w-lg text-emerald-100/80">
                  {dictionary.noResultsDescription ?? 'Try adjusting your filters or search for a different product name.'}
                </p>
                <Button variant="outline" onClick={resetFilters} className="rounded-full border-emerald-400/60 text-emerald-50">
                  {dictionary.clearFilters ?? 'Reset filters'}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.slice(0, visibleCount).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lang={lang}
                    onQuickView={() => setQuickViewProduct(product)}
                    insights={{ rating: product.__meta.rating, category: product.__meta.category }}
                  />
                ))}
              </div>
            )}

            <div ref={assignSentinelRef} aria-hidden />

            {visibleCount < filteredProducts.length ? (
              <div className="flex justify-center">
                <Button onClick={handleLoadMore} variant="ghost" className="gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {dictionary.loadingMoreLabel ?? 'Loading more products'}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(quickViewProduct)} onOpenChange={(open) => setQuickViewProduct(open ? quickViewProduct : null)}>
        <DialogContent className="w-[95vw] sm:w-auto max-w-[1080px] max-h-[90vh] overflow-hidden rounded-3xl border-emerald-900/50 bg-gradient-to-br from-background via-background to-emerald-950/80 p-0">
          {quickViewProduct ? (
            <ScrollArea className="h-full max-h-[calc(90vh-2rem)]">
              {(() => {
                const pricing = getDiscountedUnitPrice(quickViewProduct);
                const hasDiscount = pricing.discountAmount > 0;
                return (
                  <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,320px)_1fr]">
                    <div className="relative aspect-square overflow-hidden rounded-2xl border border-emerald-800/60">
                      <Image
                        src={quickViewProduct.images[0]?.url ?? '/placeholder-image.svg'}
                        alt={quickViewProduct.name}
                        fill
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-6">
                      <DialogHeader className="space-y-3">
                        <DialogTitle className="text-2xl font-bold text-emerald-50">
                          {quickViewProduct.name}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-emerald-100/80">
                          {quickViewDictionary.description}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="rounded-full bg-emerald-500/20 text-emerald-100">
                          {quickViewProduct.__meta.category}
                        </Badge>
                        <RatingStars
                          rating={quickViewProduct.__meta.rating}
                          label={dictionary.ratingAriaLabel?.replace(
                            '{{rating}}',
                            quickViewProduct.__meta.rating.toFixed(1),
                          )}
                        />
                      </div>

                      <div className="flex flex-col">
                        <p className="text-3xl font-black text-emerald-200">
                          {formatPrice(lang, pricing.finalUnitPrice)}
                        </p>
                        {hasDiscount ? (
                          <span className="text-sm text-emerald-100/70 line-through">
                            {formatPrice(lang, pricing.unitPrice)}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-sm leading-relaxed text-emerald-100/80">
                        {quickViewProduct.description}
                      </p>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        {isAuthenticated ? (
                          <Button
                            onClick={() => handleQuickViewAddToCart(quickViewProduct)}
                            disabled={authLoading || isAdding}
                            className="flex-1 gap-2 rounded-full"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isAdding ? dictionary.addingToCart ?? dictionary.addToCart : dictionary.addToCart}
                          </Button>
                        ) : null}
                        <Button asChild variant="secondary" className="flex-1 rounded-full">
                          <Link href={`/${lang}/products/${quickViewProduct.slug}`}>
                            {quickViewDictionary.goToProduct}
                          </Link>
                        </Button>
                      </div>

                      {!isAuthenticated && dictionary.loginToAddToCart ? (
                        <p className="text-xs text-emerald-100/60">
                          {dictionary.loginToAddToCart}{' '}
                          {dictionary.loginAction ? (
                            <Link href={`/${lang}/auth/login`} className="font-semibold text-emerald-200 underline">
                              {dictionary.loginAction}
                            </Link>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </ScrollArea>
          ) : (
            <div className="flex flex-col gap-3 p-8">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

