import * as Sentry from '@sentry/nextjs';
import { createBrowserSentryOptions } from '@/modules/observability/config/sentry-options';

// Only initialize Sentry if DSN is provided
if (typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_SENTRY_DSN)) {
  const browserOptions = createBrowserSentryOptions();

  Sentry.init({
    ...browserOptions,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;