// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Only initialize if DSN is provided
const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

const isSentryDebugEnabled =
  process.env.SENTRY_DEBUG === 'true' || process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true';

const isSentryLogsEnabled =
  process.env.SENTRY_ENABLE_LOGS === 'true' ||
  process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS === 'true';

if (DSN) {
  Sentry.init({
    dsn: DSN,

    // Use environment variable for sample rate, default to 20% in production
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2'),

    // Enable logs to be sent to Sentry (opt-in)
    enableLogs: isSentryLogsEnabled,

    // Print Sentry debug logs to the console (opt-in)
    debug: isSentryDebugEnabled,

    // Configure environment
    environment: process.env.NODE_ENV || 'development',

    // Ignore common errors
    ignoreErrors: [
      'top.GLOBALS',
      'chrome-extension',
      'moz-extension',
      'NetworkError',
      'Network request failed',
      'ResizeObserver loop limit exceeded',
    ],

    // Before sending to Sentry, scrub sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
        delete event.request.headers['stripe-signature'];
        delete event.request.headers['paypal-transmission-sig'];
      }

      // Remove sensitive query params
      if (event.request?.url) {
        const url = new URL(event.request.url);
        url.searchParams.delete('token');
        url.searchParams.delete('api_key');
        url.searchParams.delete('secret');
        event.request.url = url.toString();
      }

      return event;
    },
  });
}
