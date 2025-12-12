// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension',
      'moz-extension',
      // Network errors
      'NetworkError',
      'Network request failed',
      // Random plugins/extensions
      'ResizeObserver loop limit exceeded',
    ],

    // Sample transactions intelligently
    tracesSampler: (samplingContext) => {
      // Always sample errors
      if (samplingContext.transactionContext.name?.includes('error')) {
        return 1.0;
      }

      // Sample payment-related transactions at higher rate
      if (samplingContext.transactionContext.name?.includes('payment') ||
          samplingContext.transactionContext.name?.includes('webhook')) {
        return 0.5;
      }

      // Use default sample rate for other transactions
      return parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2');
    },

    // Performance monitoring
    integrations: [
      Sentry.httpIntegration(),
      Sentry.prismaIntegration(),
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
