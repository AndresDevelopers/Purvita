import { getEnv, EnvironmentConfigurationError } from '../env';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';

/**
 * Startup validation service for critical security configurations
 * This should be called during application startup to prevent insecure deployments
 */
export class StartupValidationService {
  private static instance: StartupValidationService;
  private validated = false;

  static getInstance(): StartupValidationService {
    if (!StartupValidationService.instance) {
      StartupValidationService.instance = new StartupValidationService();
    }
    return StartupValidationService.instance;
  }

  /**
   * Validate critical environment variables for production deployments
   * This should be called in server-side entry points
   */
  validateProductionEnvironment(): void {
    if (this.validated) {
      return;
    }

    const env = getEnv();
    const isProduction = process.env.NODE_ENV === 'production';
    const errors: string[] = [];
    const warnings: string[] = [];

    // Critical validations for production
    if (isProduction) {
      // Validate Supabase service role key for admin operations
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required for production deployments');
      }

      // Validate CRON secret for secure cron job execution
      if (!env.CRON_SECRET) {
        errors.push('CRON_SECRET is required for production deployments');
      } else if (env.CRON_SECRET.length < 32) {
        errors.push('CRON_SECRET must be at least 32 characters long for security');
      }

      // Validate CSRF secret for secure CSRF protection
      if (!(env as any).NEXTAUTH_SECRET && !(env as any).NEXTAUTH_SECRET) {
        errors.push('NEXTAUTH_SECRET is required for production deployments (or NEXTAUTH_SECRET as fallback)');
      } else if ((env as any).NEXTAUTH_SECRET && (env as any).NEXTAUTH_SECRET.length < 32) {
        warnings.push('NEXTAUTH_SECRET should be at least 32 characters long for better security');
      }

      // Validate encryption keys
      if (!env.CREDENTIALS_ENCRYPTION_KEY) {
        warnings.push('CREDENTIALS_ENCRYPTION_KEY is recommended for production (data encryption)');
      }

      if (!env.CUSTOM_ID_SECRET) {
        warnings.push('CUSTOM_ID_SECRET is recommended for production (secure ID generation)');
      }

      // Validate monitoring configuration
      if (!env.SENTRY_DSN && !env.NEXT_PUBLIC_SENTRY_DSN) {
        warnings.push('Sentry DSN is recommended for production error monitoring');
      }
    }

    // Log validation results
    if (errors.length > 0 || warnings.length > 0) {
      
      if (errors.length > 0) {
        SecurityAuditLogger.log(
          SecurityEventType.STARTUP_VALIDATION_FAILED,
          SecurityEventSeverity.CRITICAL,
          `Startup validation failed: ${errors.join('; ')}`,
          { errors, warnings },
          false
        );
        
        throw new EnvironmentConfigurationError([
          {
            code: 'custom',
            message: `Production environment validation failed: ${errors.join('; ')}`,
            path: ['startup']
          }
        ]);
      }

      if (warnings.length > 0) {
        SecurityAuditLogger.log(
          SecurityEventType.STARTUP_VALIDATION_WARNING,
          SecurityEventSeverity.WARNING,
          `Startup validation warnings: ${warnings.join('; ')}`,
          { warnings },
          true
        );
        
        console.warn('Startup validation warnings:', warnings.join('; '));
      }
    }

    // Log successful validation
    if (isProduction && errors.length === 0) {
      SecurityAuditLogger.log(
        SecurityEventType.STARTUP_VALIDATION_PASSED,
        SecurityEventSeverity.INFO,
        'Startup validation passed successfully',
        {
          hasServiceRoleKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
          hasCronSecret: !!env.CRON_SECRET,
          cronSecretLength: env.CRON_SECRET?.length || 0,
          hasCsrfSecret: !!((env as any).NEXTAUTH_SECRET || (env as any).NEXTAUTH_SECRET),
          csrfSecretLength: ((env as any).NEXTAUTH_SECRET || (env as any).NEXTAUTH_SECRET)?.length || 0,
          hasCredentialsEncryptionKey: !!env.CREDENTIALS_ENCRYPTION_KEY
        },
        true
      );
    }

    this.validated = true;
  }

  /**
   * Validate environment for server-side usage
   * This should be called in API routes and server components
   */
  validateServerEnvironment(): void {
    const env = getEnv();
    
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new EnvironmentConfigurationError([
        {
          code: 'custom',
          message: 'SUPABASE_SERVICE_ROLE_KEY is required for server-side operations',
          path: ['server']
        }
      ]);
    }
  }

  /**
   * Validate environment for cron job execution
   */
  validateCronEnvironment(): void {
    const env = getEnv();
    
    if (!env.CRON_SECRET) {
      throw new EnvironmentConfigurationError([
        {
          code: 'custom',
          message: 'CRON_SECRET is required for cron job execution',
          path: ['cron']
        }
      ]);
    }
    
    if (env.CRON_SECRET.length < 32) {
      throw new EnvironmentConfigurationError([
        {
          code: 'custom',
          message: 'CRON_SECRET must be at least 32 characters long',
          path: ['cron']
        }
      ]);
    }
  }
}

// Export singleton instance
export const startupValidation = StartupValidationService.getInstance();