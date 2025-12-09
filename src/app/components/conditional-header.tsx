'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Header from './header';
import AffiliateHeader from './affiliate-header';
import type { Locale } from '@/i18n/config';
import type { AppDictionary } from '@/i18n/dictionaries';
import { supabase } from '@/lib/supabase';
import { useTawkCleanup } from '@/hooks/use-tawk-cleanup';

interface ConditionalHeaderProps {
  lang: Locale;
  dictionary: AppDictionary;
}

const AFFILIATE_CONTEXT_KEY = 'affiliate_context';

interface AffiliateContext {
  affiliateCode: string;
  timestamp: number;
}

export default function ConditionalHeader({ lang, dictionary }: ConditionalHeaderProps) {
  const pathname = usePathname();
  const [affiliateContext, setAffiliateContext] = useState<AffiliateContext | null>(null);
  const [mounted, setMounted] = useState(false);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

  // Clean up Tawk.to widget when navigating away from products pages
  useTawkCleanup();

  useEffect(() => {
    setMounted(true);

    // Check if we have affiliate context in sessionStorage (more secure than localStorage)
    const stored = sessionStorage.getItem(AFFILIATE_CONTEXT_KEY);
    if (stored) {
      try {
        const context = JSON.parse(stored) as AffiliateContext;
        // Check if context is less than 1 hour old
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - context.timestamp < oneHour) {
          setAffiliateContext(context);
        } else {
          // Context expired, remove it
          sessionStorage.removeItem(AFFILIATE_CONTEXT_KEY);
        }
      } catch (error) {
        console.error('Error parsing affiliate context:', error);
        sessionStorage.removeItem(AFFILIATE_CONTEXT_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // If we're on an affiliate page, save the context (using sessionStorage for security)
    if (pathname?.includes('/affiliate/')) {
      const match = pathname.match(/\/affiliate\/([^/]+)/);
      if (match && match[1]) {
        const context: AffiliateContext = {
          affiliateCode: match[1],
          timestamp: Date.now(),
        };
        sessionStorage.setItem(AFFILIATE_CONTEXT_KEY, JSON.stringify(context));
        setAffiliateContext(context);
      }
    }

    // If we're on login page and NOT from affiliate, clear context
    if (pathname?.includes('/auth/login') && !pathname?.includes('affiliateCode=')) {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('affiliateCode')) {
        sessionStorage.removeItem(AFFILIATE_CONTEXT_KEY);
        setAffiliateContext(null);
      }
    }
  }, [pathname, mounted]);

  // Fetch custom logo when affiliate context changes
  useEffect(() => {
    if (!affiliateContext?.affiliateCode) {
      setCustomLogoUrl(null);
      return;
    }

    const fetchCustomLogo = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('affiliate_store_logo_url')
          .ilike('referral_code', affiliateContext.affiliateCode)
          .single();

        if (!error && data?.affiliate_store_logo_url) {
          setCustomLogoUrl(data.affiliate_store_logo_url);
        } else {
          setCustomLogoUrl(null);
        }
      } catch (error) {
        console.error('Error fetching custom logo:', error);
        setCustomLogoUrl(null);
      }
    };

    fetchCustomLogo();
  }, [affiliateContext]);

  if (!mounted) {
    return null;
  }

  // Determine which header to show
  const isAffiliatePage = pathname?.includes('/affiliate/');
  const isCartOrCheckout = pathname?.includes('/cart') || pathname?.includes('/checkout');
  const isLoginPage = pathname?.includes('/auth/login');

  // Show affiliate header if:
  // 1. We're on an affiliate page, OR
  // 2. We're on cart/checkout and have affiliate context, OR
  // 3. We're on login page and have affiliate context
  const shouldShowAffiliateHeader = 
    isAffiliatePage || 
    (isCartOrCheckout && affiliateContext) ||
    (isLoginPage && affiliateContext);

  if (shouldShowAffiliateHeader && affiliateContext) {
    return (
      <AffiliateHeader
        lang={lang}
        dictionary={dictionary}
        affiliateCode={affiliateContext.affiliateCode}
        customLogoUrl={customLogoUrl}
      />
    );
  }

  // Show main header for all other cases
  return <Header lang={lang} />;
}

