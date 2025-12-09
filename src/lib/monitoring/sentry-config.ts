/**
 * Sentry Monitoring Configuration
 *
 * Enhanced Sentry configuration for production monitoring.
 * Includes custom error filtering, sensitive data scrubbing,
 * and performance monitoring.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Sensitive data patterns to filter from error reports
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /credit[_-]?card/i,
  /ssn/i,
  /social[_-]?security/i,
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/i, // Bearer tokens
  /\d{13,19}/, // Credit card numbers
  /\d{3}-\d{2}-\d{4}/, // SSN format
];

/**
 * Scrub sensitive data from strings
 */
function scrubSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    let scrubbed = data;
    for (const pattern of SENSITIVE_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    }
    return scrubbed;
  }

  if (Array.isArray(data)) {
    return data.map(item => scrubSensitiveData(item));
  }

  if (data && typeof data === 'object') {
    const scrubbed: unknown = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = scrubSensitiveData(value);
      }
    }
    return scrubbed;
  }

  return data;
}

/**
 * Configure Sentry before errors
 */
export function configureSentryBeforeSend(event: Sentry.Event): Sentry.Event | null {
  // Scrub sensitive data from exception messages
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map(exception => ({
      ...exception,
      value: exception.value ? (scrubSensitiveData(exception.value) as string) : exception.value,
    })) as any;
  }

  // Scrub sensitive data from breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
      ...breadcrumb,
      message: breadcrumb.message ? (scrubSensitiveData(breadcrumb.message) as string) : breadcrumb.message,
      data: breadcrumb.data ? scrubSensitiveData(breadcrumb.data) : breadcrumb.data,
    })) as any;
  }

  // Scrub sensitive data from context
  if (event.contexts) {
    event.contexts = scrubSensitiveData(event.contexts) as any;
  }

  // Scrub sensitive data from extra
  if (event.extra) {
    event.extra = scrubSensitiveData(event.extra) as any;
  }

  // Scrub sensitive data from request
  if (event.request) {
    if (event.request.data) {
      event.request.data = scrubSensitiveData(event.request.data);
    }
    if (event.request.headers) {
      const headers: any = event.request.headers;
      // Redact authorization headers
      if (headers.authorization) headers.authorization = '[REDACTED]';
      if (headers.Authorization) headers.Authorization = '[REDACTED]';
      if (headers['x-api-key']) headers['x-api-key'] = '[REDACTED]';
      event.request.headers = headers;
    }
  }

  return event;
}

/**
 * Filter transactions for performance monitoring
 */
export function configureSentryTracesSampler(samplingContext: any): number {
  // Always sample health check endpoints at lower rate
  if (samplingContext.request?.url?.includes('/api/health')) {
    return 0.01; // 1% sampling
  }

  // Sample payment endpoints at higher rate
  if (samplingContext.request?.url?.includes('/api/payments')) {
    return 0.5; // 50% sampling
  }

  // Sample webhook endpoints at higher rate
  if (samplingContext.request?.url?.includes('/api/webhooks')) {
    return 0.8; // 80% sampling
  }

  // Sample admin endpoints at moderate rate
  if (samplingContext.request?.url?.includes('/api/admin')) {
    return 0.3; // 30% sampling
  }

  // Default sampling rate
  return parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.2');
}

/**
 * Custom error fingerprinting for better grouping
 */
export function configureSentryFingerprint(event: Sentry.Event): Sentry.Event {
  // Group payment errors by type
  if (event.exception?.values?.[0]?.value?.includes('Payment')) {
    const provider = String(event.tags?.provider || 'unknown');
    event.fingerprint = ['payment-error', provider];
  }

  // Group webhook errors by provider
  if (event.exception?.values?.[0]?.value?.includes('webhook')) {
    const provider = String(event.tags?.provider || (event.request?.url?.includes('stripe') ? 'stripe' : 'paypal'));
    event.fingerprint = ['webhook-error', provider];
  }

  // Group rate limit errors
  if (event.exception?.values?.[0]?.value?.includes('rate limit')) {
    event.fingerprint = ['rate-limit-exceeded'];
  }

  // Group authentication errors
  if (event.exception?.values?.[0]?.value?.includes('Unauthorized') ||
      event.exception?.values?.[0]?.value?.includes('Forbidden')) {
    event.fingerprint = ['auth-error'];
  }

  return event;
}

/**
 * Get Sentry configuration options
 */
export function getSentryConfig() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV as any || 'development',

    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.2'),
    tracesSampler: configureSentryTracesSampler,

    // Session Replay
    replaysSessionSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1'),
    replaysOnErrorSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || '1.0'),

    // Error filtering and scrubbing
    beforeSend: (event: Sentry.Event) => {
      const scrubbedEvent = configureSentryBeforeSend(event);
      if (!scrubbedEvent) return null;
      const fingerprintedEvent = configureSentryFingerprint(scrubbedEvent);
      return fingerprintedEvent;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Facebook borked
      'fb_xd_fragment',
      // ISP "optimizing" proxy - `Cache-Control: no-transform` seems to reduce this. (thanks @acdha)
      'bmi_SafeAddOnload',
      'EBCallBackMessageReceived',
      // See http://toolbar.conduit.com/Developer/HtmlAndGadget/Methods/JSInjection.aspx
      'conduitPage',
      // Generic error messages that aren't useful
      'Script error.',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],

    // Filter out certain transactions
    beforeSendTransaction: (event: Sentry.Event) => {
      // Don't send health check transactions
      if (event.request?.url?.includes('/api/health')) {
        return null as unknown;
      }
      return event;
    },
  };
}

/**
 * Create custom tags for better filtering
 */
export function setSentryTags(tags: Record<string, string | number | bigint | boolean>) {
  Sentry.setTags(tags);
}

/**
 * Set user context (sanitized)
 */
export function setSentryUser(user: { id: string; email?: string; role?: string }) {
  Sentry.setUser({
    id: user.id,
    // Don't send email to Sentry for privacy
    username: user.email ? `user-${user.id.substring(0, 8)}` : undefined,
    role: user.role,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for better context
 */
export function addSentryBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message: scrubSensitiveData(message) as string,
    category,
    level,
    data: data ? scrubSensitiveData(data) : undefined,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture exception manually
 */
export function captureSentryException(
  error: Error,
  context?: Record<string, any>
) {
  Sentry.captureException(error, {
    extra: context ? (scrubSensitiveData(context) as any) : undefined,
  });
}

/**
 * Capture message manually
 */
export function captureSentryMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  Sentry.captureMessage(scrubSensitiveData(message) as string, {
    level: level as Sentry.SeverityLevel,
    extra: context ? (scrubSensitiveData(context) as any) : undefined,
  });
}
