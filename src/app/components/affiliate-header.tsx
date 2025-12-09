'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Network, Menu, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import AffiliateUserMenu from './affiliate-user-menu';
import { useCallback as _useCallback, useEffect, useState } from 'react';
import { supabase, getSafeSession } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useSiteBranding } from '@/contexts/site-branding-context';
import type { AppDictionary } from '@/i18n/dictionaries';
import { useCurrentUserCountry } from '@/modules/profile/hooks/use-current-user-country';
import { useCountryCartAvailability } from '@/modules/products/hooks/use-country-cart-availability';

interface AffiliateHeaderProps {
  lang: Locale;
  dictionary: AppDictionary;
  affiliateCode: string;
  customLogoUrl?: string | null;
}

export default function AffiliateHeader({ lang, dictionary, affiliateCode, customLogoUrl }: AffiliateHeaderProps) {
  const { branding } = useSiteBranding();
  const _pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { country: userCountry, isLoading: countryLoading } = useCurrentUserCountry({
    userId: user?.id ?? null,
    isAuthenticated,
    isAuthLoading: !authChecked,
  });

  const shouldCheckCartAvailability = mounted && authChecked && isAuthenticated;
  const { allowed: isCartAllowedForCountry, isLoading: cartAvailabilityLoading } = useCountryCartAvailability(
    userCountry,
    { enabled: shouldCheckCartAvailability },
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await getSafeSession();
        if (isMounted) {
          setUser(session?.user ?? null);
          setIsAuthenticated(!!session?.user);
          setAuthChecked(true);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const shouldDisplayCart =
    mounted &&
    authChecked &&
    isAuthenticated &&
    !countryLoading &&
    !cartAvailabilityLoading &&
    isCartAllowedForCountry;

  const homeHref = `/${lang}/affiliate/${affiliateCode}`;

  const handleLinkClick = () => {
    setIsSheetOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:border-white/10 dark:bg-[#0b1910]/95 dark:shadow-none dark:supports-[backdrop-filter]:bg-[#0b1910]/80">
      <div className="flex min-h-16 py-2 items-center w-full px-4 md:px-6">
        {/* Logo */}
        <Link
          href={homeHref}
          className={`mr-6 flex items-center${mounted && (branding.logoPosition === 'above' ? ' flex-col gap-1' : branding.logoPosition === 'below' ? ' flex-col-reverse gap-1' : ' flex-row gap-2')}`}
        >
          {/* Custom affiliate logo takes priority */}
          {customLogoUrl ? (
            <Image
              src={customLogoUrl}
              alt="Store logo"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          ) : branding.showLogo && branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={`${branding.appName} logo`}
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          ) : branding.showLogo ? (
            <Network className="h-12 w-12 text-primary" />
          ) : null}
          {branding.showAppName && (
            <span className="font-bold hidden sm:inline-block font-headline dark:text-slate-100 text-sm">
              {branding.appName}
            </span>
          )}
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop Actions */}
        <div className="flex flex-1 items-center justify-end space-x-2">
          <div className="hidden md:flex items-center space-x-2">
            {/* Cart Icon - Only for authenticated users */}
            {shouldDisplayCart && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/${lang}/affiliate/${affiliateCode}/cart`}>
                  <ShoppingCart className="h-5 w-5" />
                  <span className="sr-only">{dictionary.navigation?.cart || 'Cart'}</span>
                </Link>
              </Button>
            )}

            {/* User Menu or Auth Buttons */}
            {mounted && authChecked && isAuthenticated ? (
              <AffiliateUserMenu user={user} lang={lang} dict={dictionary} affiliateCode={affiliateCode} onNavigate={handleLinkClick} />
            ) : mounted && authChecked && !isAuthenticated ? (
              <>
                <Button variant="ghost" asChild>
                  <Link href={`/${lang}/affiliate/${affiliateCode}/login`}>
                    {dictionary.navigation?.login || 'Login'}
                  </Link>
                </Button>
                <Button variant="default" asChild>
                  <Link href={`/${lang}/affiliate/${affiliateCode}/register`}>
                    {dictionary.navigation?.register || 'Register'}
                  </Link>
                </Button>
              </>
            ) : null}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 mt-4">
                  {/* Logo in mobile menu */}
                  <Link
                    href={homeHref}
                    onClick={handleLinkClick}
                    className="flex items-center space-x-2 mb-4"
                  >
                    {branding.showLogo && branding.logoUrl ? (
                      <Image
                        src={branding.logoUrl}
                        alt={`${branding.appName} logo`}
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain"
                      />
                    ) : branding.showLogo ? (
                      <Network className="h-10 w-10 text-primary" />
                    ) : null}
                    {branding.showAppName && (
                      <span className="font-bold font-headline">{branding.appName}</span>
                    )}
                  </Link>

                  {/* Cart Link - Only for authenticated users */}
                  {shouldDisplayCart && (
                    <Button variant="ghost" asChild className="justify-start">
                      <Link href={`/${lang}/affiliate/${affiliateCode}/cart`} onClick={handleLinkClick}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {dictionary.navigation?.cart || 'Cart'}
                      </Link>
                    </Button>
                  )}

                  {/* User Menu or Auth Buttons */}
                  {mounted && authChecked && isAuthenticated ? (
                    <AffiliateUserMenu user={user} lang={lang} dict={dictionary} affiliateCode={affiliateCode} onNavigate={handleLinkClick} />
                  ) : mounted && authChecked && !isAuthenticated ? (
                    <div className="flex flex-col space-y-2 pt-4 border-t">
                      <Button variant="ghost" asChild className="justify-start">
                        <Link href={`/${lang}/affiliate/${affiliateCode}/login`} onClick={handleLinkClick}>
                          {dictionary.navigation?.login || 'Login'}
                        </Link>
                      </Button>
                      <Button variant="default" asChild className="justify-start">
                        <Link href={`/${lang}/affiliate/${affiliateCode}/register`} onClick={handleLinkClick}>
                          {dictionary.navigation?.register || 'Register'}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

