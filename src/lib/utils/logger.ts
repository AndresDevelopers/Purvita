/**
 * Structured Logger Service
 *
 * Provides consistent, structured logging across the application.
 * Integrates with Sentry for error tracking in production.
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/utils/logger';
 *
 * logger.info('Payment processed', { userId, amount });
 * logger.error('Payment failed', error, { userId, provider: 'stripe' });
 * logger.warn('Rate limit approaching', { userId, remaining: 5 });
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogMetadata {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  environment: string;
}

class Logger {
  private readonly isDevelopment: boolean;
  private readonly isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitize(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized: LogContext = {};
    const sensitiveKeys = [
      'password',
      'secret',
      'token',
      'api_key',
      'apiKey',
      'credit_card',
      'creditCard',
      'ssn',
      'social_security',
    ];

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value as LogContext);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Build log metadata
   */
  private buildMetadata(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogMetadata {
    const metadata: LogMetadata = {
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: process.env.NODE_ENV || 'development',
    };

    if (context) {
      metadata.context = this.sanitize(context);
    }

    if (error) {
      metadata.error = {
        message: error.message,
        name: error.name,
        ...(this.isDevelopment && { stack: error.stack }),
      };
    }

    return metadata;
  }

  /**
   * Format log message for console
   */
  private formatConsole(metadata: LogMetadata): string {
    if (this.isDevelopment) {
      // Pretty format for development
      const parts = [
        `[${metadata.level.toUpperCase()}]`,
        metadata.message,
      ];

      if (metadata.context) {
        parts.push('\nContext:', JSON.stringify(metadata.context, null, 2));
      }

      if (metadata.error) {
        parts.push('\nError:', metadata.error.message);
        if (metadata.error.stack) {
          parts.push('\n', metadata.error.stack);
        }
      }

      return parts.join(' ');
    } else {
      // JSON format for production (easier to parse)
      return JSON.stringify(metadata);
    }
  }

  /**
   * Send log to console
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const metadata = this.buildMetadata(level, message, context, error);
    const formatted = this.formatConsole(metadata);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        this.sendToSentry(metadata);
        break;
    }
  }

  /**
   * Send error to Sentry (only in production)
   */
  private sendToSentry(metadata: LogMetadata): void {
    if (!this.isProduction) return;

    try {
      // Only import Sentry if it's available
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        const Sentry = (window as any).Sentry;
        Sentry.captureException(new Error(metadata.message), {
          level: metadata.level,
          extra: {
            context: metadata.context,
            error: metadata.error,
          },
        });
      } else if (typeof global !== 'undefined') {
        // Server-side Sentry
        import('@sentry/nextjs')
          .then(Sentry => {
            Sentry.captureException(new Error(metadata.message), {
              level: metadata.level as any,
              extra: {
                context: metadata.context,
                error: metadata.error,
              },
            });
          })
          .catch(() => {
            // Sentry not available, silent fail
          });
      }
    } catch (_error) {
      // Silent fail if Sentry is not available
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  /**
   * Log info message (only in development to reduce production noise)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('info', message, context);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Log payment event (specialized)
   */
  payment(
    action: 'initiated' | 'completed' | 'failed',
    provider: 'stripe' | 'paypal' | 'wallet',
    context: LogContext
  ): void {
    const level = action === 'failed' ? 'error' : 'info';
    this.log(level, `Payment ${action}`, { ...context, provider, category: 'payment' });
  }

  /**
   * Log auth event (specialized)
   */
  auth(
    action: 'login' | 'logout' | 'failed' | 'admin_access',
    context: LogContext
  ): void {
    const level = action === 'failed' ? 'warn' : 'info';
    this.log(level, `Auth ${action}`, { ...context, category: 'auth' });
  }

  /**
   * Log security event (specialized)
   */
  security(event: string, context: LogContext): void {
    this.log('warn', `Security: ${event}`, { ...context, category: 'security' });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogLevel, LogContext };
