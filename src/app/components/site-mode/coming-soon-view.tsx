'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Mail as _Mail, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createDefaultComingSoonSettings,
  type SiteModeComingSoonCountdown,
  type SiteModeSocialPlatform,
} from '@/modules/site-status/domain/models/site-mode';
import { buildSocialPlatformLabelMap, getSocialIconForPlatform } from './social-platforms';
import { LanguageSelector } from './language-selector';
import { useDynamicFavicon } from '@/hooks/use-dynamic-favicon';

const DEFAULT_COMING_SOON_BRANDING = createDefaultComingSoonSettings().branding;
const DEFAULT_GRADIENT_COLORS = DEFAULT_COMING_SOON_BRANDING.backgroundGradientColors;

interface ComingSoonCopy {
  title?: string;
  description?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  emailSubtitle?: string;
  submit?: string;
  submitting?: string;
  successTitle?: string;
  successDescription?: string;
  alreadyTitle?: string;
  alreadyDescription?: string;
  missingConfig?: string;
  errorTitle?: string;
  errorDescription?: string;
  socialTitle?: string;
  socialDescription?: string;
  socialPlatforms?: Partial<Record<SiteModeSocialPlatform, string>>;
  countdownTitle?: string;
  countdownLabel?: string;
  countdownNumericLabel?: string;
  countdownExpired?: string;
  countdownUnits?: {
    days?: string;
    hours?: string;
    minutes?: string;
    seconds?: string;
  };
  waitlistUnavailableTitle?: string;
  waitlistUnavailableDescription?: string;
  footerNote?: string;
}

interface ComingSoonWaitlistStatus {
  isEnabled: boolean;
  isConfigured: boolean;
}

interface ComingSoonViewProps {
  copy?: ComingSoonCopy;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  appName: string;
  waitlistStatus: ComingSoonWaitlistStatus;
  backgroundImageUrl?: string | null;
  backgroundMode?: 'image' | 'gradient';
  backgroundGradientColors?: string[];
  backgroundOverlayOpacity?: number;
  socialLinks?: { platform: SiteModeSocialPlatform; url: string }[];
  title?: string | null;
  description?: string | null;
  countdown?: SiteModeComingSoonCountdown;
}

type SubmissionState = 'idle' | 'loading' | 'success' | 'already' | 'error' | 'missingConfig';

interface CountdownSnapshot {
  hasEnded: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const buildCountdownSnapshot = (
  config: SiteModeComingSoonCountdown,
  currentTime: number,
): CountdownSnapshot | null => {
  if (!config.isEnabled || config.style !== 'date' || !config.targetDate) {
    return null;
  }

  const target = new Date(config.targetDate);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const diff = target.getTime() - currentTime;

  if (diff <= 0) {
    return {
      hasEnded: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hasEnded: false,
    days,
    hours,
    minutes,
    seconds,
  };
};

const pad = (value: number): string => value.toString().padStart(2, '0');

export function ComingSoonView({
  copy,
  logoUrl,
  faviconUrl,
  appName,
  waitlistStatus,
  backgroundImageUrl,
  backgroundMode,
  backgroundGradientColors,
  backgroundOverlayOpacity = 90,
  socialLinks = [],
  title,
  description,
  countdown,
}: ComingSoonViewProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isEnabled: isWaitlistEnabled, isConfigured: isWaitlistConfigured } = waitlistStatus;

  // Update favicon dynamically
  useDynamicFavicon(faviconUrl);

  const sanitizedLinks = useMemo(
    () =>
      socialLinks
        .map((link) => ({
          platform: link.platform,
          url: typeof link.url === 'string' ? link.url.trim() : '',
        }))
        .filter((link) => Boolean(link.platform) && link.url.length > 0),
    [socialLinks],
  );
  const socialPlatformLabels = useMemo(
    () => buildSocialPlatformLabelMap(copy?.socialPlatforms),
    [copy?.socialPlatforms],
  );
  const normalizedBackgroundMode = backgroundMode === 'gradient' ? 'gradient' : 'image';
  const gradientColors = useMemo(() => {
    const source = backgroundGradientColors ?? DEFAULT_GRADIENT_COLORS;
    const sanitized = source
      .map((color) => (typeof color === 'string' ? color.trim().toLowerCase() : ''))
      .filter((color) => /^#([0-9a-f]{6})$/.test(color));

    if (sanitized.length >= 2) {
      return sanitized.slice(0, 5);
    }

    return DEFAULT_GRADIENT_COLORS;
  }, [backgroundGradientColors]);
  const hasBackgroundImage = Boolean(backgroundImageUrl && backgroundImageUrl.trim().length > 0);
  const hasValidGradient = gradientColors.length >= 2;
  const shouldRenderGradientBackground = normalizedBackgroundMode === 'gradient' && hasValidGradient;
  const shouldRenderImageBackground = normalizedBackgroundMode === 'image' && hasBackgroundImage;
  const overlayOpacity = Math.max(0, Math.min(100, backgroundOverlayOpacity)) / 100;
  const hasLogo = Boolean(logoUrl && logoUrl.trim().length > 0);
  const heroTitle = title ?? copy?.title ?? 'Our site is under construction';
  const heroDescription =
    description ?? copy?.description ?? "We'll be online very soon.";
  const gradientStyle = useMemo(
    () => `linear-gradient(135deg, ${gradientColors.join(', ')})`,
    [gradientColors],
  );
  const logoInitial = useMemo(() => {
    const initial = appName?.trim().charAt(0) ?? '';
    return initial ? initial.toUpperCase() : 'P';
  }, [appName]);

  const countdownConfig = useMemo(
    () => countdown ?? createDefaultComingSoonSettings().countdown,
    [countdown],
  );

  const [countdownSnapshot, setCountdownSnapshot] = useState<CountdownSnapshot | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(2024); // Default to prevent hydration mismatch

  useEffect(() => {
    // Set current year on client side to prevent hydration mismatch
    setCurrentYear(new Date().getFullYear());
    
    if (!countdownConfig.isEnabled || countdownConfig.style !== 'date' || !countdownConfig.targetDate) {
      setCountdownSnapshot(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      setCountdownSnapshot(buildCountdownSnapshot(countdownConfig, now));
    };

    updateCountdown();

    const id = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(id);
  }, [countdownConfig]);

  const shouldShowNumericCountdown =
    countdownConfig.isEnabled &&
    countdownConfig.style === 'numeric' &&
    typeof countdownConfig.numericValue === 'number';

  const shouldShowDateCountdown =
    countdownConfig.isEnabled &&
    countdownConfig.style === 'date' &&
    Boolean(countdownConfig.targetDate) &&
    Boolean(countdownSnapshot);

  const hasCountdownEnded = Boolean(countdownSnapshot?.hasEnded);
  const countdownLabel = countdownConfig.label ?? copy?.countdownLabel ?? '';
  const numericLabel =
    countdownConfig.label ??
    copy?.countdownNumericLabel ??
    copy?.countdownLabel ??
    'Days remaining';
  const countdownTitle = copy?.countdownTitle ?? '';
  const countdownUnits = {
    days: copy?.countdownUnits?.days ?? 'Days',
    hours: copy?.countdownUnits?.hours ?? 'Hours',
    minutes: copy?.countdownUnits?.minutes ?? 'Minutes',
    seconds: copy?.countdownUnits?.seconds ?? 'Seconds',
  };

  const waitlistAvailable =
    isWaitlistEnabled && isWaitlistConfigured && state !== 'missingConfig';
  const showWaitlistSection = isWaitlistEnabled;
  const showWaitlistForm = waitlistAvailable;
  const isSubmitting = state === 'loading';
  const showSuccess = state === 'success' || state === 'already';
  const footerNote = copy?.footerNote ?? 'All rights reserved.';

  const resetStateOnChange = (value: string) => {
    setEmail(value);

    if (state === 'error' || state === 'success' || state === 'already') {
      setState('idle');
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isWaitlistEnabled || !isWaitlistConfigured) {
      setState('missingConfig');
      return;
    }

    setState('loading');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/site-status/coming-soon/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = (await response.json()) as { status?: 'subscribed' | 'already_subscribed' };
        if (data.status === 'already_subscribed') {
          setState('already');
        } else {
          setState('success');
          setEmail('');
        }
        return;
      }

      if (response.status === 503) {
        setState('missingConfig');
        return;
      }

      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setErrorMessage(body?.message ?? copy?.errorDescription ?? 'We could not save your request.');
      setState('error');
    } catch (error) {
      console.error('[ComingSoonView] Failed to submit email', error);
      setErrorMessage(copy?.errorDescription ?? 'We could not save your request.');
      setState('error');
    }
  };

  useEffect(() => {
    if (!isWaitlistEnabled) {
      setState('idle');
      setErrorMessage(null);

      if (email) {
        setEmail('');
      }

      return;
    }

    if (isWaitlistConfigured && state === 'missingConfig') {
      setState('idle');
    }
  }, [isWaitlistEnabled, isWaitlistConfigured, state, email]);

  return (
    <div className="relative flex min-h-screen flex-col text-foreground">
      {/* Background Layer - Fixed positioning for better rendering */}
      {shouldRenderImageBackground && backgroundImageUrl ? (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat bg-[image:var(--bg-image)]"
            style={{ '--bg-image': `url("${backgroundImageUrl}")` } as React.CSSProperties}
            data-testid="coming-soon-background-image"
          />
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-10 bg-black opacity-[var(--overlay-opacity)]"
            style={{ '--overlay-opacity': overlayOpacity } as React.CSSProperties}
            data-testid="coming-soon-background-overlay"
          />
        </>
      ) : shouldRenderGradientBackground ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-20 bg-cover bg-center bg-[image:var(--gradient)]"
          style={{ '--gradient': gradientStyle } as React.CSSProperties}
          data-testid="coming-soon-background-gradient"
        />
      ) : null}

      <header className="relative z-20 flex items-center justify-between px-6 py-6">
        <div className="flex items-center">
          {hasLogo && logoUrl ? (
            <div className="relative h-12 w-auto">
              <Image
                src={logoUrl}
                alt={appName}
                width={192}
                height={48}
                className="h-12 w-auto object-contain"
                priority
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10 text-xl font-semibold text-foreground">
              {logoInitial}
            </div>
          )}
        </div>
        <LanguageSelector />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-8 sm:px-6">
        <div className="flex w-full max-w-4xl flex-col items-center gap-12 text-center">
          <section className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              {heroTitle}
            </h1>
            <p className="text-lg font-bold text-black sm:text-xl">
              {heroDescription}
            </p>
          </section>

          {(shouldShowNumericCountdown || shouldShowDateCountdown) && (
            <section className="flex w-full flex-col items-center gap-8">
              {countdownTitle && (
                <span className="text-sm font-semibold uppercase tracking-wider text-black">
                  {countdownTitle}
                </span>
              )}

              {shouldShowNumericCountdown && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center justify-center rounded-lg bg-black px-12 py-8 font-mono text-7xl font-bold text-white">
                    {countdownConfig.numericValue}
                  </div>
                  <span className="text-base font-medium text-black">{numericLabel}</span>
                </div>
              )}

              {shouldShowDateCountdown && countdownSnapshot && !hasCountdownEnded && (
                <div className="flex flex-wrap items-center justify-center gap-6">
                  {[
                    { label: countdownUnits.days, value: pad(countdownSnapshot.days) },
                    { label: countdownUnits.hours, value: pad(countdownSnapshot.hours) },
                    { label: countdownUnits.minutes, value: pad(countdownSnapshot.minutes) },
                    { label: countdownUnits.seconds, value: pad(countdownSnapshot.seconds) },
                  ].map((segment, index, segments) => (
                    <div key={`${segment.label}-${segment.value}`} className="flex flex-col items-center gap-2">
                      <span className="text-sm font-semibold text-black">
                        {segment.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {segment.value.split('').map((digit, digitIndex) => (
                          <div key={digitIndex} className="flex h-16 w-12 items-center justify-center rounded-lg bg-black font-mono text-4xl font-bold text-white sm:h-20 sm:w-14 sm:text-5xl">
                            {digit}
                          </div>
                        ))}
                        {index < segments.length - 1 && (
                          <span className="text-3xl font-bold text-black sm:text-4xl">:</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {shouldShowDateCountdown && hasCountdownEnded && (
                <p className="text-lg text-black">
                  {copy?.countdownExpired ?? 'We are putting the final touches together.'}
                </p>
              )}

              {countdownLabel && (
                <p className="text-base text-black">{countdownLabel}</p>
              )}
            </section>
          )}

          {showWaitlistSection && (
            <section className="w-full max-w-xl space-y-4">
              {showWaitlistForm ? (
                <div className="space-y-4">
                  <p className="text-base font-medium text-black">
                    {copy?.emailLabel ?? 'Subscribe to get notified:'}
                  </p>

                  <form
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
                    onSubmit={handleSubmit}
                    noValidate
                  >
                    <div className="flex-1 sm:max-w-xs">
                      <Input
                        id="coming-soon-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => resetStateOnChange(event.target.value)}
                        placeholder={copy?.emailPlaceholder ?? 'Enter your email'}
                        disabled={isSubmitting || showSuccess}
                        className="h-11 w-full rounded-md bg-white/90 px-4 text-base text-black placeholder:text-gray-500"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting || showSuccess || !email}
                      className="h-11 rounded-md bg-black px-6 text-base font-medium text-white hover:bg-black/90"
                    >
                      {isSubmitting ? (
                        copy?.submitting ?? 'Subscribing...'
                      ) : showSuccess ? (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" aria-hidden="true" />
                          {state === 'already'
                            ? copy?.alreadyTitle ?? 'Already subscribed'
                            : copy?.successTitle ?? "You're on the list!"}
                        </>
                      ) : (
                        copy?.submit ?? 'Subscribe'
                      )}
                    </Button>
                  </form>

                  {showSuccess && (
                    <Alert className="border-emerald-500/40 bg-emerald-500/15 text-left">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <AlertTitle>
                        {state === 'already'
                          ? copy?.alreadyTitle ?? 'You are already subscribed'
                          : copy?.successTitle ?? "You're on the list!"}
                      </AlertTitle>
                      <AlertDescription>
                        {state === 'already'
                          ? copy?.alreadyDescription ?? 'We will let you know as soon as we go live.'
                          : copy?.successDescription ?? 'Thank you for joining the waitlist. We will be in touch soon.'}
                      </AlertDescription>
                    </Alert>
                  )}

                  {state === 'error' && waitlistAvailable && (
                    <Alert variant="destructive" className="text-left">
                      <AlertTitle>{copy?.errorTitle ?? 'Something went wrong'}</AlertTitle>
                      <AlertDescription>
                        {errorMessage ?? copy?.errorDescription ?? 'Please try again.'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <h2 className="text-xl font-semibold text-black">
                    {copy?.waitlistUnavailableTitle ?? 'Waitlist unavailable for now'}
                  </h2>
                  <p className="text-base text-black">
                    {state === 'missingConfig'
                      ? copy?.missingConfig ??
                        'The waitlist is not available yet. Please try again later.'
                      : copy?.waitlistUnavailableDescription ??
                        'We are configuring our launch experience. Come back soon to join the waitlist.'}
                  </p>
                </div>
              )}
            </section>
          )}

          {sanitizedLinks.length > 0 && (
            <section className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-black">
                {copy?.socialTitle ?? 'Follow us for updates'}
              </p>
              {copy?.socialDescription && (
                <p className="mx-auto max-w-md text-sm text-black">
                  {copy.socialDescription}
                </p>
              )}
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
                      className="h-12 w-12 rounded-full border-black/30 text-black hover:border-black/50 hover:bg-black/5"
                    >
                      <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">{label}</span>
                      </a>
                    </Button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="z-10 w-full bg-black px-4 py-3 text-center text-sm text-white">
        {`${appName} ${currentYear} • ${footerNote}`}
      </footer>
    </div>
  );
}
