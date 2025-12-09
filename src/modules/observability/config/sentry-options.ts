const DEFAULT_ENVIRONMENT =
  process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development';

const clampRate = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }

  return fallback;
};

export const createBrowserSentryOptions = () => ({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: DEFAULT_ENVIRONMENT,
  tracesSampleRate: clampRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.1),
  replaysSessionSampleRate: clampRate(
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    0.1,
  ),
  replaysOnErrorSampleRate: clampRate(
    process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    1,
  ),
  debug: process.env.NODE_ENV !== 'production',
});

export const createServerSentryOptions = () => ({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: DEFAULT_ENVIRONMENT,
  tracesSampleRate: clampRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
  debug: process.env.NODE_ENV !== 'production',
});

export const createEdgeSentryOptions = () => ({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: DEFAULT_ENVIRONMENT,
  tracesSampleRate: clampRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
  debug: process.env.NODE_ENV !== 'production',
});
