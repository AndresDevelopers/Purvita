import {
  detectMissingSupabaseEnv,
  formatMissingSupabaseEnvMessage,
  type SupabaseEnvKey,
} from '@/lib/utils/supabase-env';

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  productsBucket: string;
  mailchimpApiKey?: string;
  upstashRedisUrl?: string;
  upstashRedisToken?: string;
  adminLoginBypassPath?: string;
}

const REQUIRED_CLIENT_ENV: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const DEFAULT_SUPABASE_URL = 'https://placeholder.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'public-anon-key';

export class EnvironmentService {
  private static instance: EnvironmentService;
  private config: EnvironmentConfig;

  private constructor() {
    // Next.js automatically loads environment variables based on NODE_ENV:
    // - Development (npm run dev): reads .env.local, .env.development.local, .env.development, .env
    // - Production (npm run build/start): reads .env.production.local, .env.local, .env.production, .env
    // No manual dotenv loading is needed - we rely on Next.js built-in behavior
    this.config = this.loadConfig();
  }

  static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  private loadConfig(): EnvironmentConfig {
    const missingKeys = detectMissingSupabaseEnv(REQUIRED_CLIENT_ENV);

    if (missingKeys.length > 0) {
      console.warn(`[EnvironmentService] ${formatMissingSupabaseEnvMessage(missingKeys)}. Using placeholder values.`);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

    return {
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      productsBucket: process.env.PRODUCTS_BUCKET || 'products',
      mailchimpApiKey: process.env.MAILCHIMP_API_KEY,
      upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
      upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
      adminLoginBypassPath: process.env.ADMIN_LOGIN_BYPASS_PATH,
    };
  }

  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  hasServiceRoleKey(): boolean {
    return !!this.config.supabaseServiceRoleKey;
  }

  getServiceRoleKey(): string | undefined {
    return this.config.supabaseServiceRoleKey;
  }

  hasRedisConfig(): boolean {
    return !!(this.config.upstashRedisUrl && this.config.upstashRedisToken);
  }

  getRedisConfig(): { url: string; token: string } | undefined {
    if (!this.hasRedisConfig()) {
      return undefined;
    }
    return {
      url: this.config.upstashRedisUrl!,
      token: this.config.upstashRedisToken!,
    };
  }
}