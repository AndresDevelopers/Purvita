 
import { z } from 'zod';

export class EnvironmentConfigurationError extends Error {
  public readonly issues: z.ZodIssue[];

  public readonly missingKeys: string[];

  constructor(issues: z.ZodIssue[]) {
    const missing = Array.from(
      new Set(
        issues
          .map((issue) => issue.path?.[0])
          .filter((path): path is string => typeof path === 'string'),
      ),
    );

    const message =
      missing.length > 0
        ? `Invalid environment configuration. Missing values for: ${missing.join(', ')}`
        : 'Invalid environment configuration. Please check required variables.';

    super(message);
    this.name = 'EnvironmentConfigurationError';
    this.issues = issues;
    this.missingKeys = missing;
  }
}

// Custom validator for hex strings
const hexString = (length: number) =>
  z.string().refine(
    (val) => {
      const hexRegex = /^[0-9a-fA-F]+$/;
      return hexRegex.test(val) && val.length === length;
    },
    {
      message: `Must be a ${length}-character hexadecimal string`,
    }
  );

// Environment schema for validation
// Note: SUPABASE_SERVICE_ROLE_KEY is optional because:
// 1. It should NEVER be used in client-side code (browser)
// 2. It's only required in server-side code (API routes, server components)
// 3. Making it optional here prevents errors when this module is imported in client components
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(), // Optional - only for server-side use
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  API_RATE_LIMIT_REQUESTS: z.coerce.number().int().positive().optional(),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  // Login Rate Limiting - Brute Force Protection
  LOGIN_RATE_LIMIT_ATTEMPTS: z.coerce.number().int().positive().optional(),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
  // CORS Configuration
  ALLOWED_CORS_ORIGINS: z.string().optional(),
  // Advanced Fraud Detection
  IPHUB_API_KEY: z.string().optional(),
  // Webhook Security
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  // Upstash Redis - Optional for caching and rate limiting
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Security - Encryption Keys
  CREDENTIALS_ENCRYPTION_KEY: hexString(64).optional(), // 64 hex chars = 32 bytes for AES-256
  CUSTOM_ID_SECRET: hexString(64).optional(), // 64 hex chars = 32 bytes for HMAC
  // Cron Security
  CRON_SECRET: z.string().min(32).optional(), // Minimum 32 characters for security
  // Sentry Monitoring
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Payment Providers - PayPal Production
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
  PAYPAL_WEBHOOK_SECRET: z.string().min(1).optional(),
  PAYPAL_CONNECT_CLIENT_ID: z.string().min(1).optional(),

  // Payment Providers - PayPal Test/Sandbox
  PAYPAL_TEST_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_TEST_CLIENT_SECRET: z.string().min(1).optional(),
  PAYPAL_TEST_WEBHOOK_SECRET: z.string().min(1).optional(),
  PAYPAL_TEST_CONNECT_CLIENT_ID: z.string().min(1).optional(),

  // Payment Providers - Stripe Production
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().min(1).optional(),

  // Payment Providers - Stripe Test
  STRIPE_TEST_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_TEST_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_TEST_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_TEST_CONNECT_CLIENT_ID: z.string().min(1).optional(),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;
let warnedMissingAppUrl = false;

const loadEnv = (): Env => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    API_RATE_LIMIT_REQUESTS: process.env.API_RATE_LIMIT_REQUESTS,
    API_RATE_LIMIT_WINDOW_MS: process.env.API_RATE_LIMIT_WINDOW_MS,
    LOGIN_RATE_LIMIT_ATTEMPTS: process.env.LOGIN_RATE_LIMIT_ATTEMPTS,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    ALLOWED_CORS_ORIGINS: process.env.ALLOWED_CORS_ORIGINS,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY,
    CUSTOM_ID_SECRET: process.env.CUSTOM_ID_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
  });

  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Environment variable validation failed:', parsed.error);
    }
    throw new EnvironmentConfigurationError(parsed.error.issues);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
};

export const getEnv = (): Env => loadEnv();

export const env: Env = new Proxy({} as Env, {
  get: (_target, prop: keyof Env) => loadEnv()[prop],
});

/**
 * Get the application base URL with fallback
 */
export const getAppUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    return envUrl;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const normalized = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
    return normalized.replace(/\/$/, '');
  }

  const defaultLocalUrl = 'http://localhost:9002';

  if (process.env.NODE_ENV === 'production' && !warnedMissingAppUrl) {
    console.warn(
      'NEXT_PUBLIC_APP_URL is not set. Falling back to the local development URL. '
        + 'Configure NEXT_PUBLIC_APP_URL to ensure canonical links are accurate.'
    );
    warnedMissingAppUrl = true;
  }

  return defaultLocalUrl;
};

export type { Env };
