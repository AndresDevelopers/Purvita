import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/app/components/theme-provider';
import { CartProvider } from '@/contexts/cart-context';
import { ReferralTrackingProvider } from '@/contexts/referral-tracking-context';
import { SiteBrandingProvider } from '@/contexts/site-branding-context';
import { TutorialProvider } from '@/components/tutorial/tutorial-provider';
import { getSiteBranding } from '@/modules/site-content/services/site-content-service';
import { ErrorBoundaryFallback } from '@/modules/observability/components/error-boundary-fallback';
import { AdvertisingScriptsInjector } from '@/components/advertising/advertising-scripts-injector';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { i18n } from '@/i18n/config';
import { StructuredDataScript } from '@/components/seo/structured-data-script';
import { ResourceHints, PreloadCriticalResources } from '@/components/seo/resource-hints';
import { SearchConsoleVerification } from '@/components/seo/search-console-verification';
import { getSeoPayloadForPage } from '@/lib/seo/page-seo';
import { generateOrganizationSchema, generateWebSiteSchema } from '@/lib/seo/structured-data-generators';
import { getAppUrl } from '@/lib/env';
import './globals.css';

// Use system fonts instead of Google Fonts for build compatibility
const _fontVariables = '--font-body --font-headline';

// Conditionally import Sentry ErrorBoundary
let ErrorBoundary: unknown = ({ children }: { children: React.ReactNode }) => children;
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    const sentry = require('@sentry/nextjs');
    ErrorBoundary = sentry.ErrorBoundary;
  } catch (_error) {
    // Sentry not available, use fallback
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [branding, seoPayload] = await Promise.all([
    getSiteBranding(),
    getSeoPayloadForPage('global', i18n.defaultLocale, '/'),
  ]);

  const faviconUrl = branding.faviconUrl ?? '/favicon.svg';
  const isSvgIcon = faviconUrl.endsWith('.svg');
  const isIco = faviconUrl.endsWith('.ico');
  const iconType = isSvgIcon ? 'image/svg+xml' : isIco ? 'image/x-icon' : undefined;

  return {
    ...seoPayload.metadata,
    icons: {
      icon: [
        {
          url: faviconUrl,
          type: iconType,
        },
      ],
      shortcut: [
        {
          url: faviconUrl,
          type: iconType,
        },
      ],
      apple: [
        {
          url: faviconUrl,
        },
      ],
    },
    alternates: {
      ...(seoPayload.metadata.alternates ?? {}),
      languages: Object.fromEntries(i18n.locales.map((locale) => [locale, `/${locale}`])),
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: branding.appName,
    },
    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },
    manifest: '/manifest.json',
  } satisfies Metadata;
}

export async function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: '#10b981' },
      { media: '(prefers-color-scheme: dark)', color: '#059669' },
    ],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [branding, seoPayload] = await Promise.all([
    getSiteBranding(),
    getSeoPayloadForPage('global', i18n.defaultLocale, '/'),
  ]);
  const faviconUrl = branding.faviconUrl ?? '/favicon.svg';
  const isSvgIcon = faviconUrl.endsWith('.svg');
  const isIco = faviconUrl.endsWith('.ico');
  const faviconType = isSvgIcon ? 'image/svg+xml' : isIco ? 'image/x-icon' : undefined;

  // Generate global structured data
  const baseUrl = getAppUrl();
  const organizationSchema = generateOrganizationSchema(baseUrl, branding.appName, branding.description ?? undefined);
  const websiteSchema = generateWebSiteSchema(baseUrl, branding.appName);

  return (
    <html lang={i18n.defaultLocale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <SearchConsoleVerification />
        <ResourceHints />
        <PreloadCriticalResources />
        <link rel="icon" href={faviconUrl} {...(faviconType ? { type: faviconType } : {})} />
        <link rel="shortcut icon" href={faviconUrl} {...(faviconType ? { type: faviconType } : {})} />
        <link rel="apple-touch-icon" href={faviconUrl} />
      </head>
      <body
        className="min-h-screen bg-background font-sans antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SiteBrandingProvider initialBranding={branding}>
            <ReferralTrackingProvider>
              <CartProvider>
                <TutorialProvider>
                  {/* @ts-expect-error - ErrorBoundary type issue */}
                  <ErrorBoundary fallback={<ErrorBoundaryFallback />}>
                    <StructuredDataScript json={seoPayload.structuredData} />
                    <StructuredDataScript json={organizationSchema} />
                    <StructuredDataScript json={websiteSchema} />
                    <AdvertisingScriptsInjector />
                    <GoogleAnalytics />
                    {children}
                  </ErrorBoundary>
                  <Toaster />
                </TutorialProvider>
                <Analytics
                  mode={process.env.NODE_ENV === 'production' ? 'production' : 'development'}
                  debug={process.env.NODE_ENV !== 'production'}
                />
                <SpeedInsights />
              </CartProvider>
            </ReferralTrackingProvider>
          </SiteBrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
