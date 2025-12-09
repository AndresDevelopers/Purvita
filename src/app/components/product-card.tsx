"use client";

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, ShoppingCart, Star } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useCart } from '@/contexts/cart-context';
import { useCurrencyForCountry } from '@/contexts/app-settings-context';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import { useCurrentUserCountry } from '@/modules/profile/hooks/use-current-user-country';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';

type ProductCardProps = {
  product: Product;
  lang: Locale;
  onQuickView?: (product: Product) => void;
  insights?: {
    rating?: number;
    category?: string;
  };
  variant?: 'default' | 'landingHighlight' | 'affiliate';
  affiliateCode?: string; // For affiliate pages
};

export default function ProductCard({ product, lang, onQuickView, insights, variant = 'default', affiliateCode }: ProductCardProps) {
  const dict = getDictionary(lang);
  const router = useRouter();
  const { addItem } = useCart();
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
  const quickViewLabel = 'View';
  const isLandingHighlight = variant === 'landingHighlight';
  const isAffiliatePage = variant === 'affiliate';
  const pricing = useMemo(() => getDiscountedUnitPrice(product), [product]);
  const hasDiscount = pricing.discountAmount > 0;
  const currencyCode = useMemo(() => resolveCurrency(userCountry), [resolveCurrency, userCountry]);
  const currencyFormatter = useMemo(() => {
    const buildFormatter = (currency: string) => {
      try {
        return new Intl.NumberFormat(lang === 'es' ? 'es' : 'en', {
          style: 'currency',
          currency,
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
    };

    return buildFormatter(currencyCode);
  }, [currencyCode, lang]);
  const formattedFinalPrice = useMemo(
    () => currencyFormatter.format(pricing.finalUnitPrice),
    [currencyFormatter, pricing.finalUnitPrice],
  );
  const formattedUnitPrice = useMemo(
    () => currencyFormatter.format(pricing.unitPrice),
    [currencyFormatter, pricing.unitPrice],
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

  const addedToCartTitle = dict.products.addedToCartTitle ?? dict.products.addToCart;
  const addedToCartMessage = useMemo(() => {
    const template = dict.products.addedToCartDescription ?? '';
    if (!template) {
      return product.name;
    }

    return template.includes('{{product}}')
      ? template.replace('{{product}}', product.name)
      : `${template} ${product.name}`;
  }, [dict.products.addedToCartDescription, product.name]);

  const addToCartLabel = useMemo(() => {
    if (isAdding) {
      return dict.products.addingToCart ?? dict.products.addToCart;
    }

    return dict.products.addToCart;
  }, [dict.products.addToCart, dict.products.addingToCart, isAdding]);

  const checkingAvailabilityLabel =
    dict.products.checkingAvailability ?? 'Checking availability…';
  const unavailableLabel =
    dict.products.unavailableInCountry ?? 'This product is not available in your country yet.';

  const handleAddToCart = () => {
    if (!isAuthenticated || isAdding || !isCountryAllowed) {
      return;
    }

    setIsAdding(true);
    addItem(product);

    // Store the affiliate page URL as the return URL for after payment
    if (isAffiliatePage && affiliateCode) {
      try {
        // Store the full current URL (affiliate page)
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        if (currentUrl) {
          sessionStorage.setItem('payment_return_url', currentUrl);
        }
      } catch (error) {
        console.error('[ProductCard] Failed to store return URL:', error);
      }
    }

    toast({
      title: addedToCartTitle,
      description: addedToCartMessage,
      duration: 2500,
    });
    navigator.vibrate?.(12);

    // Redirect to the appropriate cart
    if (isAffiliatePage && affiliateCode) {
      router.push(`/${lang}/affiliate/${affiliateCode}/cart`);
    } else {
      router.push(`/${lang}/cart`);
    }

    // Provide a short delay so the user perceives feedback before enabling again.
    setTimeout(() => setIsAdding(false), 400);
  };

  const productDescription = useMemo(() => {
    if (!product.description) {
      return '';
    }

    const snippet = product.description.substring(0, 100);
    return product.description.length > 100 ? `${snippet}.` : snippet;
  }, [product.description]);

  const loginMessage = !isLoading && !isAuthenticated ? dict.products.loginToAddToCart : null;
  const shouldShowLoginMessage = loginMessage && !isLandingHighlight && !isAffiliatePage;
  const viewDetailsHref = isAffiliatePage && affiliateCode
    ? `/${lang}/affiliate/${affiliateCode}/product/${product.slug}`
    : `/${lang}/products/${product.slug}`;
  const ratingValue = useMemo(() => {
    if (typeof insights?.rating !== 'number' || Number.isNaN(insights.rating)) {
      return null;
    }
    return Math.round(insights.rating * 10) / 10;
  }, [insights?.rating]);

  const ratingAriaLabel = ratingValue
    ? dict.products.ratingAriaLabel?.replace('{{rating}}', ratingValue.toFixed(1)) ?? `${ratingValue.toFixed(1)} / 5`
    : undefined;

  const canShowAddToCartButton =
    isAuthenticated && !isLoading && !isCountryLoading && isCountryAllowed;
  const shouldShowCountryRestriction =
    isAuthenticated && !isLoading && !isCountryLoading && !isCountryAllowed;

  return (
    <Card className="flex h-full flex-col overflow-hidden border border-gray-100 bg-gray-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl group dark:border-emerald-900/40 dark:bg-[#10271c]">
      <CardHeader className="relative p-0">
        <Link
          href={viewDetailsHref}
          className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden"
        >
          <Image
            src={product.images[0]?.url || '/placeholder-image.svg'}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            data-ai-hint={product.images[0]?.hint || product.name}
            priority={false}
          />
          {hasDiscount && pricing.discount?.label ? (
            <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
              {pricing.discount.label}
            </span>
          ) : null}
        </Link>
        {onQuickView ? (
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-lg backdrop-blur transition hover:bg-white dark:bg-emerald-900/80 dark:text-emerald-50"
          >
            <Link href={viewDetailsHref} onClick={(event) => event.stopPropagation()}>
              <Eye className="mr-1 h-3.5 w-3.5" />
              {quickViewLabel}
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-grow flex-col gap-3 p-6 text-gray-600 dark:text-emerald-100/80">
        <CardTitle className="mb-2 text-xl leading-tight font-headline text-gray-900 dark:text-emerald-50">
          <Link href={viewDetailsHref} className="transition-colors hover:text-primary">
            {product.name}
          </Link>
        </CardTitle>
        <p className="flex-grow text-sm leading-relaxed text-gray-600 dark:text-emerald-100/70 sm:text-base">
          {productDescription}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 p-6 pt-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xl font-bold text-primary dark:text-emerald-300">
              {formattedFinalPrice}
            </p>
            {hasDiscount ? (
              <p className="text-xs text-muted-foreground line-through">
                {formattedUnitPrice}
              </p>
            ) : null}
            {ratingValue ? (
              <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-500" aria-label={ratingAriaLabel}>
                <Star className="h-4 w-4 fill-amber-400" />
                {ratingValue.toFixed(1)}
              </div>
            ) : null}
          </div>
        </div>
        {canShowAddToCartButton ? (
          <Button onClick={handleAddToCart} disabled={isLoading || isAdding} className="w-full gap-2">
            <ShoppingCart className="h-4 w-4" />
            {addToCartLabel}
          </Button>
        ) : null}
        {isAuthenticated && !isLoading ? (
          isCountryLoading ? (
            <Button variant="outline" disabled className="w-full justify-center text-xs">
              {checkingAvailabilityLabel}
            </Button>
          ) : shouldShowCountryRestriction ? (
            <div className="w-full rounded-md border border-dashed border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
              {unavailableLabel}
            </div>
          ) : null
        ) : null}
        {shouldShowLoginMessage ? (
          <p className="text-center text-xs text-muted-foreground">
            {loginMessage}{' '}
            <Link href={`/${lang}/auth/login`} className="font-medium text-primary hover:underline">
              {dict.products.loginAction}
            </Link>
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}

