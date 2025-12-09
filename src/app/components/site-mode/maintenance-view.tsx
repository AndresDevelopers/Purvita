'use client';

import Image from 'next/image';
import { ShieldAlert, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from './language-selector';
import { useDynamicFavicon } from '@/hooks/use-dynamic-favicon';
import { buildSocialPlatformLabelMap, getSocialIconForPlatform } from './social-platforms';
import type { SiteModeSocialPlatform } from '@/modules/site-status/domain/models/site-mode';

interface MaintenanceCopy {
  title?: string;
  description?: string;
  info?: string;
  socialTitle?: string;
  badge?: string;
  footerNote?: string;
  socialPlatforms?: Partial<Record<SiteModeSocialPlatform, string>>;
}

interface MaintenanceViewProps {
  copy?: MaintenanceCopy;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  appName: string;
  backgroundImageUrl?: string;
  backgroundOverlayOpacity?: number;
  socialLinks?: { platform: SiteModeSocialPlatform; url: string }[];
}

export function MaintenanceView({
  copy,
  logoUrl,
  faviconUrl,
  appName,
  backgroundImageUrl,
  backgroundOverlayOpacity = 90,
  socialLinks = [],
}: MaintenanceViewProps) {
  const sanitizedLinks = (socialLinks ?? [])
    .map((link) => ({
      platform: link.platform,
      url: typeof link.url === 'string' ? link.url.trim() : '',
    }))
    .filter((link) => Boolean(link.platform) && link.url.length > 0);
  const socialPlatformLabels = buildSocialPlatformLabelMap(copy?.socialPlatforms);
  const hasBackground = Boolean(backgroundImageUrl && backgroundImageUrl.trim().length > 0);
  const overlayOpacity = Math.max(0, Math.min(100, backgroundOverlayOpacity)) / 100;
  const hasLogo = Boolean(logoUrl && logoUrl.trim().length > 0);

  // Update favicon dynamically
  useDynamicFavicon(faviconUrl);

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Background Image */}
      {hasBackground && backgroundImageUrl && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat bg-[image:var(--bg-image)]"
            style={{ '--bg-image': `url("${backgroundImageUrl}")` } as React.CSSProperties}
          />
          <div 
            className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-background opacity-[var(--overlay-opacity)]" 
            style={{ '--overlay-opacity': overlayOpacity } as React.CSSProperties}
          />
        </>
      )}
      {!hasBackground && (
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-muted/20 to-background" />
      )}

      {/* Language Selector - Top Right */}
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LanguageSelector />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-3xl">
          {/* Logo and Status Badge */}
          <div className="mb-8 flex flex-col items-center gap-4">
            {hasLogo && logoUrl ? (
              <div className="relative h-16 w-auto sm:h-20">
                <Image
                  src={logoUrl}
                  alt={appName}
                  width={240}
                  height={80}
                  className="h-16 w-auto object-contain sm:h-20"
                  priority
                />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
                <div className="relative rounded-full bg-gradient-to-br from-primary/20 to-primary/5 p-6 shadow-lg">
                  <ShieldAlert className="h-12 w-12 text-primary sm:h-16 sm:w-16" aria-hidden="true" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2">
              <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {copy?.badge ?? 'Maintenance Mode'}
              </span>
            </div>
          </div>

          {/* Main Card */}
          <div className="rounded-3xl border border-border/60 bg-background/90 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
            <div className="space-y-6 text-center">
              {/* Title */}
              <h1 className="font-headline text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                {copy?.title ?? 'We will be back soon'}
              </h1>

              {/* Description */}
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
                {copy?.description ?? 'We are improving the experience. Thank you for your patience.'}
              </p>

              {/* Divider */}
              <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />

              {/* Additional Info */}
              <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
                {copy?.info ?? 'In the meantime, feel free to check back shortly or reach out to your administrator if you need urgent assistance.'}
              </p>

              {/* Social Links */}
              {sanitizedLinks.length > 0 && (
                <div className="pt-6">
                  <p className="mb-4 text-sm font-semibold text-foreground/90">
                    {copy?.socialTitle ?? 'Stay connected with us'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {sanitizedLinks.map((link, index) => {
                      const Icon = getSocialIconForPlatform(link.platform);
                      const label = socialPlatformLabels[link.platform];

                      return (
                        <Button
                          key={`${link.platform}-${index}`}
                          variant="outline"
                          size="icon"
                          asChild
                          className="h-11 w-11 rounded-full border-foreground/40 bg-background/80 text-foreground transition-transform hover:-translate-y-0.5 hover:border-foreground/70"
                        >
                          <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">{label}</span>
                          </a>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <p className="mt-8 text-center text-xs text-muted-foreground/60">
            {copy?.footerNote ?? "This page will automatically refresh when we're back online"}
          </p>
        </div>
      </div>
    </div>
  );
}
