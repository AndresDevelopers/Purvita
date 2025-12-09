import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';

import { createServerSentryOptions } from '@/modules/observability/config/sentry-options';

type RequestLike = Request | NextRequest;

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'x-user-id', // Deprecated header that should not be logged
  'stripe-signature',
  'paypal-transmission-id',
  'paypal-transmission-sig',
  'paypal-cert-url',
]);

const MASKED_VALUE = '[REDACTED]';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeHeaders(headers: Headers): Record<string, string> {
  return Array.from(headers.entries()).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? MASKED_VALUE : value;
    return acc;
  }, {});
}

function normalizeRequestContext(request: unknown): Record<string, unknown> | undefined {
  if (request instanceof Request) {
    return {
      method: request.method,
      url: request.url,
      headers: sanitizeHeaders(request.headers),
    };
  }

  if (isRecord(request)) {
    return request;
  }

  return undefined;
}

function normalizeAdditionalContext(context: unknown): Record<string, unknown> | undefined {
  if (isRecord(context)) {
    return context;
  }

  if (context instanceof Request) {
    return normalizeRequestContext(context);
  }

  return context === undefined ? undefined : { value: context };
}

export async function register() {
  // Only initialize Sentry if DSN is provided
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const serverOptions = createServerSentryOptions();

    Sentry.init({
      ...serverOptions,
    });
  }
}

export async function onRequestError(err: unknown, request: RequestLike | unknown, context: unknown) {
  // Only report errors if Sentry is enabled
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const requestContext = normalizeRequestContext(request);
    const additionalContext = normalizeAdditionalContext(context);

    const contexts: Record<string, Record<string, unknown>> = {};

    if (requestContext) {
      contexts.request = requestContext;
    }

    if (additionalContext) {
      contexts.context = additionalContext;
    }

    Sentry.captureException(err, Object.keys(contexts).length ? { contexts } : undefined);
  }
}
