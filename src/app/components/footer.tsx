'use client';

import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { Network, Facebook, Twitter, Instagram, Linkedin, Youtube, Music2, Globe } from "lucide-react";
import LanguageSwitcher from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { useLocaleContent } from "@/contexts/locale-content-context";
import { useSiteBranding } from "@/contexts/site-branding-context";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, getSafeSession } from "@/lib/supabase";
import { 
  filterLinksByVisibility, 
  type UserVisibilityContext 
} from "@/modules/site-content/hooks/use-link-visibility";

const isExternalHref = (href: string) =>
  href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:');

export default function Footer({ lang }: { lang: Locale }) {
  const { dictionary, landingContent } = useLocaleContent();
  const { branding } = useSiteBranding();
  const currentYear = new Date().getFullYear();
  const footerContent = landingContent.footer;
  
  // Auth state for visibility filtering
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'past_due' | 'canceled' | 'unpaid' | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<'mlm' | 'affiliate' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session } } = await getSafeSession();
        setIsAuthenticated(!!session?.user);
        
        if (session?.user) {
          // Fetch user plan info for visibility
          fetch('/api/user/plan')
            .then(res => res.json())
            .then(data => {
              if (data.subscriptionType) setSubscriptionType(data.subscriptionType);
              if (data.subscriptionStatus) setSubscriptionStatus(data.subscriptionStatus);
              if (data.isAdmin !== undefined) setIsAdmin(data.isAdmin);
            })
            .catch(() => {});
        }
      } catch {
        setIsAuthenticated(false);
      }
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setIsAuthenticated(!!session?.user);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Build visibility context
  const visibilityContext: UserVisibilityContext = useMemo(() => ({
    isAuthenticated,
    hasActiveSubscription: subscriptionStatus === 'active',
    subscriptionType,
    isAdmin,
  }), [isAuthenticated, subscriptionStatus, subscriptionType, isAdmin]);
  const shouldShowLogo = footerContent.showBrandingLogo && branding.showLogo;
  const footerBrandingName = footerContent.brandingAppName?.trim() || branding.appName;
  const shouldShowAppName = footerContent.showBrandingAppName && footerBrandingName.length > 0;
  const shouldShowDescription = footerContent.showBrandingDescription && !!footerContent.tagline.trim();
  const shouldRenderBrandingLink = shouldShowLogo || shouldShowAppName;
  const shouldRenderBrandingBlock = shouldRenderBrandingLink || shouldShowDescription;
  const brandingOrientation = footerContent.brandingOrientation ?? 'beside';

  const resolveHref = useCallback(
    (href: string): string => {
      if (!href) return '#';
      const normalized = href.trim();
      if (normalized.startsWith('#') || isExternalHref(normalized)) {
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

  const navigationLinks = useMemo(
    () => {
      // Filter links based on visibility rules
      const filteredLinks = filterLinksByVisibility(footerContent.navigationLinks, visibilityContext);
      return filteredLinks.map((link) => ({
        ...link,
        href: link.href.startsWith('#') ? link.href : resolveHref(link.href),
      }));
    },
    [footerContent.navigationLinks, resolveHref, visibilityContext],
  );

  const legalLinks = useMemo(
    () => {
      // Filter links based on visibility rules
      const filteredLinks = filterLinksByVisibility(footerContent.legalLinks, visibilityContext);
      return filteredLinks.map((link) => ({
        ...link,
        href: resolveHref(link.href),
      }));
    },
    [footerContent.legalLinks, resolveHref, visibilityContext],
  );

  const socialLinks = footerContent.socialLinks;

  const getSocialIcon = (platform: typeof socialLinks[number]['platform']) => {
    switch (platform) {
      case 'facebook':
        return <Facebook />;
      case 'instagram':
        return <Instagram />;
      case 'twitter':
        return <Twitter />;
      case 'linkedin':
        return <Linkedin />;
      case 'youtube':
        return <Youtube />;
      case 'tiktok':
        return <Music2 />;
      default:
        return <Globe />;
    }
  };

  return (
    <footer className="mt-auto border-t border-border bg-muted dark:border-white/10 dark:bg-[#0b1910]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            {shouldRenderBrandingBlock && (
              <div className="space-y-3">
                {shouldRenderBrandingLink && (
                  <Link
                    href={`/${lang}`}
                    className={`flex text-foreground dark:text-emerald-50 ${
                      brandingOrientation === 'above'
                        ? 'flex-col items-start gap-3'
                        : brandingOrientation === 'below'
                          ? 'flex-col-reverse items-start gap-3'
                          : 'flex-row items-center gap-3'
                    }`}
                  >
                    {shouldShowLogo && (
                      branding.logoUrl ? (
                        <Image
                          src={branding.logoUrl}
                          alt={`${footerBrandingName} logo`}
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <Network className="h-7 w-7 text-primary" />
                      )
                    )}
                    {shouldShowAppName && (
                      <span className="font-bold text-xl font-headline">{footerBrandingName}</span>
                    )}
                  </Link>
                )}
                {shouldShowDescription && (
                  <p className="text-sm text-muted-foreground dark:text-slate-300">
                    {footerContent.tagline}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{dictionary.footer.navigation}</h3>
            <ul className="space-y-2">
              {navigationLinks.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-primary dark:text-slate-300 dark:hover:text-emerald-300">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{dictionary.footer.legal}</h3>
            <ul className="space-y-2">
              {legalLinks.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-primary dark:text-slate-300 dark:hover:text-emerald-300">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{dictionary.footer.followUs}</h3>
            <div className="flex space-x-4">
              {socialLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="text-muted-foreground transition-colors hover:text-primary dark:text-slate-300 dark:hover:text-emerald-300"
                  aria-label={link.label}
                >
                  {getSocialIcon(link.platform)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 dark:border-white/10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground dark:text-slate-300">
              &copy; {currentYear}
              {shouldShowAppName ? (
                <>
                  {' '}
                  {footerBrandingName}.
                </>
              ) : null}{' '}
              {dictionary.footer.copy}
            </p>
            <div className="flex items-center gap-2">
              {footerContent.showThemeSwitcher && <ThemeSwitcher />}
              {footerContent.showLanguageSwitcher && <LanguageSwitcher />}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
