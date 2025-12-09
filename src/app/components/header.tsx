"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation'
import { Network, Menu, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Plan } from "@/lib/models/definitions";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import UserMenu from "./user-menu";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, getSafeSession } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useLocaleContent } from "@/contexts/locale-content-context";
import { useSiteBranding } from "@/contexts/site-branding-context";
import { useCurrentUserCountry } from "@/modules/profile/hooks/use-current-user-country";
import { useCountryCartAvailability } from "@/modules/products/hooks/use-country-cart-availability";
import { 
  filterLinksByVisibility, 
  type UserVisibilityContext 
} from "@/modules/site-content/hooks/use-link-visibility";

export default function Header({ lang }: { lang: Locale }) {
  const { dictionary, landingContent } = useLocaleContent();
  const { branding } = useSiteBranding();
  const pathname = usePathname();
  const _router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userPlan, setUserPlan] = useState<Plan | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<'mlm' | 'affiliate'>('mlm');
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
    // Get initial session
    const loadSession = async () => {
      try {
        const { data: { session } } = await getSafeSession();
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
        setAuthChecked(true);
      } catch (error) {
        console.error('Error loading Supabase session:', error);
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    };

    loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
        setAuthChecked(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'past_due' | 'canceled' | 'unpaid' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetch('/api/user/plan')
        .then(res => res.json())
        .then(data => {
          if (data.plan) setUserPlan(data.plan);
          if (data.subscriptionType) setSubscriptionType(data.subscriptionType);
          if (data.subscriptionStatus) setSubscriptionStatus(data.subscriptionStatus);
          if (data.isAdmin !== undefined) setIsAdmin(data.isAdmin);
        })
        .catch(err => console.error('Error fetching user plan:', err));
    } else {
      setUserPlan(null);
      setSubscriptionType('mlm');
      setSubscriptionStatus(null);
      setIsAdmin(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build visibility context for filtering links
  const visibilityContext: UserVisibilityContext = useMemo(() => ({
    isAuthenticated,
    hasActiveSubscription: subscriptionStatus === 'active',
    subscriptionType: subscriptionType,
    isAdmin,
  }), [isAuthenticated, subscriptionStatus, subscriptionType, isAdmin]);

  const headerContent = landingContent.header;
  const shouldDisplayCart =
    mounted &&
    authChecked &&
    isAuthenticated &&
    headerContent.showCart &&
    !countryLoading &&
    !cartAvailabilityLoading &&
    isCartAllowedForCountry;
  const resolveHref = useCallback(
    (href: string): string => {
      if (!href) return '#';
      const normalized = href.trim();
      if (
        normalized.startsWith('#') ||
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('mailto:') ||
        normalized.startsWith('tel:')
      ) {
        return normalized;
      }

      const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
      if (withLeadingSlash.startsWith(`/${lang}`)) {
        return withLeadingSlash;
      }

      return `/${lang}${withLeadingSlash}`;
    },
    [lang],
  );

  const landingNavLinks = useMemo(
    () => {
      // Filter links based on visibility rules
      const filteredLinks = filterLinksByVisibility(headerContent.landingLinks, visibilityContext);
      return filteredLinks.map((link) => ({
        ...link,
        href: link.href.startsWith('#') ? link.href : resolveHref(link.href),
      }));
    },
    [headerContent.landingLinks, resolveHref, visibilityContext],
  );

  const authenticatedNavItems = useMemo(
    () => {
      // First filter by visibility rules
      let items = filterLinksByVisibility(headerContent.authenticatedLinks, visibilityContext)
        .filter((item) => !item.requiresAuth || isAuthenticated);

      // Hide Team links for Affiliate subscriptions (subscription_type takes priority)
      const isAffiliateSubscription = subscriptionType === 'affiliate';
      
      if (isAffiliateSubscription || (userPlan && !userPlan.is_mlm_plan)) {
        // Hide Team links for affiliate users
        items = items.filter(item => !item.href.includes('team') && !item.href.includes('company-team'));
      }

      // Ensure Subscription link is visible for affiliate users
      if (isAffiliateSubscription || (userPlan && (userPlan.is_affiliate_plan || !userPlan.is_mlm_plan))) {
        const hasSubscription = items.some(item => item.href.includes('subscription'));
        if (!hasSubscription) {
          items = [...items, {
            id: 'subscription-control',
            label: dictionary.settings?.sections?.account?.items?.subscription?.title ?? 'Suscripción',
            href: '/subscription',
            requiresAuth: true,
            order: 99
          } as any];
        }
      }

      return items.map((item) => ({
        ...item,
        href: resolveHref(item.href),
      }));
    },
    [headerContent.authenticatedLinks, isAuthenticated, resolveHref, userPlan, subscriptionType, dictionary, visibilityContext],
  );
  const fallbackDashboardItem = useMemo(
    () => ({
      id: 'dashboard-fallback',
      label: dictionary.navigation?.dashboard ?? 'Dashboard',
      href: resolveHref('/dashboard'),
      requiresAuth: true,
      order: 0,
    }),
    [dictionary.navigation?.dashboard, resolveHref],
  );
  const resolvedAuthenticatedNavItems = useMemo(
    () => {
      if (!authChecked || !isAuthenticated) {
        return [];
      }

      if (authenticatedNavItems.length > 0) {
        return authenticatedNavItems;
      }

      return [fallbackDashboardItem];
    },
    [authenticatedNavItems, fallbackDashboardItem, isAuthenticated, authChecked],
  );
  const primaryActionHref = resolveHref(headerContent.primaryAction.href);
  const secondaryActionHref = resolveHref(headerContent.secondaryAction.href);

  const AuthButtons = () => (
    <>
      <Button variant="ghost" asChild>
        <Link href={secondaryActionHref}>{headerContent.secondaryAction.label}</Link>
      </Button>
      <Button asChild>
        <Link href={primaryActionHref}>{headerContent.primaryAction.label}</Link>
      </Button>
    </>
  );

  const MobileAuthButtons = () => (
    <div className="flex flex-col space-y-2 pt-4 border-t">
      <Button variant="ghost" asChild className="justify-start">
        <Link href={secondaryActionHref} onClick={() => setIsSheetOpen(false)}>{headerContent.secondaryAction.label}</Link>
      </Button>
      <Button asChild className="justify-start">
        <Link href={primaryActionHref} onClick={() => setIsSheetOpen(false)}>{headerContent.primaryAction.label}</Link>
      </Button>
    </div>
  );

  const handleLinkClick = () => {
    setIsSheetOpen(false);
  };

  const isLandingPage = pathname === `/${lang}` || pathname === `/${lang}/`;
  const isAffiliatePage = pathname?.includes('/affiliate/');
  const isRegisterPage = pathname?.includes('/auth/register');

  if (isLandingPage) {
    // Landing page header
    return (
      <header className="flex items-center justify-between whitespace-nowrap border-b border-primary/20 bg-background px-10 py-4 text-foreground shadow-sm dark:border-primary/30 dark:bg-[#0b1910] dark:text-emerald-50 dark:shadow-[0_1px_0_rgba(255,255,255,0.05)]">
        <div className={`flex items-center gap-3 text-primary${mounted && (branding.logoPosition === 'above' ? ' flex-col' : branding.logoPosition === 'below' ? ' flex-col-reverse' : ' flex-row')}`}>
          {branding.showLogo && branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={`${branding.appName} logo`}
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
            />
          ) : branding.showLogo ? (
            <div className="h-20 w-20">
              <Network className="h-full w-full" />
            </div>
          ) : null}
          {branding.showAppName && <span className="text-xl font-bold">{branding.appName}</span>}
        </div>
        <nav className="flex flex-1 items-center justify-end gap-8">
          <div className="hidden items-center gap-8 md:flex">
            {landingNavLinks.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary dark:text-slate-200"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-primary hover:bg-primary/10 dark:text-slate-200 dark:hover:bg-white/10">
              <Link href={secondaryActionHref}>{headerContent.secondaryAction.label}</Link>
            </Button>
            <Button asChild className="bg-primary text-background-dark hover:bg-primary/90 shadow-lg shadow-primary/30 dark:bg-primary/80 dark:text-[#0b1910] dark:hover:bg-primary">
              <Link href={primaryActionHref}>{headerContent.primaryAction.label}</Link>
            </Button>
          </div>
        </nav>
      </header>
    );
  }

  const homeHref = authChecked && isAuthenticated ? resolveHref('/dashboard') : `/${lang}`;

  // Default header for other pages
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:border-white/10 dark:bg-[#0b1910]/95 dark:shadow-none dark:supports-[backdrop-filter]:bg-[#0b1910]/80">
      <div className="flex min-h-16 py-2 items-center w-full px-4 md:px-6">
        <Link href={homeHref} className={`mr-6 flex items-center${mounted && (branding.logoPosition === 'above' ? ' flex-col gap-1' : branding.logoPosition === 'below' ? ' flex-col-reverse gap-1' : ' flex-row gap-2')}`}>
          {branding.showLogo && branding.logoUrl ? (
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
          {branding.showAppName && <span className="font-bold hidden sm:inline-block font-headline dark:text-slate-100 text-sm">{branding.appName}</span>}
        </Link>

        {resolvedAuthenticatedNavItems.length > 0 && (
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {resolvedAuthenticatedNavItems.map((item) => (
              <Link key={item.id} href={item.href} className="text-muted-foreground transition-colors hover:text-primary dark:text-slate-200">
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex flex-1 items-center justify-end space-x-2">
          <div className="hidden md:flex items-center space-x-2">
            {shouldDisplayCart && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/${lang}/cart`}>
                  <ShoppingCart className="h-5 w-5" />
                  <span className="sr-only">Cart</span>
                </Link>
              </Button>
            )}
            {mounted && authChecked && isAuthenticated ? <UserMenu user={user} lang={lang} dict={dictionary} onNavigate={handleLinkClick} /> : mounted && authChecked && !isAuthenticated && !isAffiliatePage && !isRegisterPage ? <AuthButtons /> : null}
          </div>

          <div className="md:hidden">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" suppressHydrationWarning={true}>
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="p-4 space-y-4">
                  <Link href={homeHref} onClick={handleLinkClick} className={`mb-4 flex items-center space-x-2${mounted && (branding.logoPosition === 'above' ? ' flex-col' : branding.logoPosition === 'below' ? ' flex-col-reverse' : ' flex-row')}`}>
                    {branding.showLogo && branding.logoUrl ? (
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
                    {branding.showAppName && <span className="font-bold font-headline">{branding.appName}</span>}
                  </Link>

                  {resolvedAuthenticatedNavItems.length > 0 && (
                    <div className="flex flex-col space-y-2">
                      {resolvedAuthenticatedNavItems.map((item) => (
                        <Button variant="ghost" asChild key={item.id} className="justify-start">
                          <Link href={item.href} onClick={handleLinkClick}>{item.label}</Link>
                        </Button>
                      ))}
                    </div>
                  )}

                  {shouldDisplayCart && (
                    <Button variant="ghost" asChild className="justify-start">
                      <Link href={`/${lang}/cart`} onClick={handleLinkClick}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {dictionary.navigation.orders}
                      </Link>
                    </Button>
                  )}

                  {mounted && authChecked && isAuthenticated ? <UserMenu user={user} lang={lang} dict={dictionary} onNavigate={handleLinkClick} /> : mounted && authChecked && !isAuthenticated && !isAffiliatePage && !isRegisterPage ? <MobileAuthButtons /> : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
