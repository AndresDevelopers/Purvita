import { headers } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import ConditionalHeader from "@/app/components/conditional-header";
import Footer from "@/app/components/footer";
import { GlobalErrorBoundary } from "@/app/components/global-error-boundary";
import { LocaleContentProvider } from "@/contexts/locale-content-context";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { SiteModeGate } from "@/app/components/site-mode/site-mode-gate";
import { StructuredDataScript } from "@/components/seo/structured-data-script";
import { PreloadResources } from "@/components/seo/preload-resources";
import { SessionTimeoutProvider } from "@/components/security/session-timeout-provider";
import type { Locale } from "@/i18n/config";
import {
  getLandingContent,
  getLocalizedDictionary,
} from "@/modules/site-content/services/site-content-service";
import { getSiteModeConfiguration } from "@/modules/site-status/services/site-mode-service";
import { getSeoPayloadForPath } from "@/lib/seo/page-seo";
import { getAppSettings } from "@/modules/app-settings/services/app-settings-service";

import { getAdminSecurityConfig } from "@/lib/security/admin-security-config";

const normalizePathname = (pathname: string, lang: Locale) => {
  if (!pathname) {
    return `/${lang}`;
  }

  const raw = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const base = raw.split("?")[0] ?? raw;
  return base === "/" ? `/${lang}` : base;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const headersList = await headers();
  const pathname = headersList.get("next-url") ?? `/${lang}`;
  const seoPayload = await getSeoPayloadForPath(normalizePathname(pathname, lang), lang);
  return seoPayload.metadata;
}

export default async function I18nLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const headersList = await headers();
  const pathname = headersList.get("next-url") ?? `/${lang}`;
  const [dictionary, landingContent, siteModeConfig, appSettings, securityConfig] = await Promise.all([
    getLocalizedDictionary(lang),
    getLandingContent(lang),
    getSiteModeConfiguration(),
    getAppSettings(),
    getAdminSecurityConfig(),
  ]);
  const seoPayload = await getSeoPayloadForPath(normalizePathname(pathname, lang), lang);

  return (
    <GlobalErrorBoundary lang={lang}>
      <AppSettingsProvider settings={appSettings}>
        <LocaleContentProvider dictionary={dictionary} landingContent={landingContent}>
          <SiteModeGate lang={lang} configuration={siteModeConfig}>
            {/* ✅ SECURITY: Session timeout configured from admin security settings */}
            <SessionTimeoutProvider
              timeoutMinutes={securityConfig.sessionTimeoutMinutes}
              warningMinutes={securityConfig.sessionWarningMinutes}
              enabled={true}
            />
            <PreloadResources />
            <StructuredDataScript json={seoPayload.structuredData} />
            <div className="flex flex-col min-h-screen">
              {/* Conditional header - shows affiliate header when appropriate */}
              <ConditionalHeader lang={lang} dictionary={dictionary} />
              <main className="flex-grow">{children}</main>
              <Footer lang={lang} />
            </div>
          </SiteModeGate>
        </LocaleContentProvider>
      </AppSettingsProvider>
    </GlobalErrorBoundary>
  );
}
