import * as Sentry from '@sentry/nextjs';

export interface SentryContext {
  userId?: string;
  email?: string;
  operation?: string;
  module?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export class SentryLogger {
  static captureException(
    error: Error | unknown,
    context?: SentryContext,
    level: Sentry.SeverityLevel = 'error'
  ): void {
    if (!error) return;

    const sentryError = error instanceof Error ? error : new Error(String(error));

    Sentry.withScope((scope) => {
      // Set severity level
      scope.setLevel(level);

      // Add user context
      if (context?.userId) {
        scope.setUser({
          id: context.userId,
          email: context.email,
        });
      }

      // Add tags
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      // Add module tag
      if (context?.module) {
        scope.setTag('module', context.module);
      }

      // Add operation tag
      if (context?.operation) {
        scope.setTag('operation', context.operation);
      }

      // Add extra context
      if (context?.extra) {
        scope.setContext('extra', context.extra);
      }

      Sentry.captureException(sentryError);
    });
  }

  static captureMessage(
    message: string,
    context?: SentryContext,
    level: Sentry.SeverityLevel = 'info'
  ): void {
    Sentry.withScope((scope) => {
      scope.setLevel(level);

      if (context?.userId) {
        scope.setUser({
          id: context.userId,
          email: context.email,
        });
      }

      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      if (context?.module) {
        scope.setTag('module', context.module);
      }

      if (context?.operation) {
        scope.setTag('operation', context.operation);
      }

      if (context?.extra) {
        scope.setContext('extra', context.extra);
      }

      Sentry.captureMessage(message, level);
    });
  }

  // Convenience methods for specific error types
  static capturePaymentError(
    error: Error | unknown,
    context: Omit<SentryContext, 'module'> & { provider?: string; amount?: number }
  ): void {
    this.captureException(error, {
      ...context,
      module: 'payments',
      tags: {
        ...context.tags,
        error_type: 'payment_error',
        provider: context.provider || 'unknown',
      },
      extra: {
        ...context.extra,
        amount: context.amount,
      },
    });
  }

  static captureSubscriptionError(
    error: Error | unknown,
    context: Omit<SentryContext, 'module'> & { subscriptionId?: string; status?: string }
  ): void {
    this.captureException(error, {
      ...context,
      module: 'subscriptions',
      tags: {
        ...context.tags,
        error_type: 'subscription_error',
        subscription_status: context.status || 'unknown',
      },
      extra: {
        ...context.extra,
        subscription_id: context.subscriptionId,
      },
    });
  }

  static captureAuthError(
    error: Error | unknown,
    context: Omit<SentryContext, 'module'> & { authMethod?: string }
  ): void {
    this.captureException(error, {
      ...context,
      module: 'auth',
      tags: {
        ...context.tags,
        error_type: 'auth_error',
        auth_method: context.authMethod || 'unknown',
      },
    });
  }

  static captureWalletError(
    error: Error | unknown,
    context: Omit<SentryContext, 'module'> & { walletId?: string; operation?: string }
  ): void {
    this.captureException(error, {
      ...context,
      module: 'wallet',
      tags: {
        ...context.tags,
        error_type: 'wallet_error',
        wallet_operation: context.operation || 'unknown',
      },
      extra: {
        ...context.extra,
        wallet_id: context.walletId,
      },
    });
  }

  static captureCommissionError(
    error: Error | unknown,
    context: Omit<SentryContext, 'module'> & { buyerId?: string; sponsorId?: string; level?: number }
  ): void {
    this.captureException(error, {
      ...context,
      module: 'commissions',
      tags: {
        ...context.tags,
        error_type: 'commission_error',
      },
      extra: {
        ...context.extra,
        buyer_id: context.buyerId,
        sponsor_id: context.sponsorId,
        commission_level: context.level,
      },
    });
  }

  static captureDatabaseError(
    error: Error | unknown,
    context: Omit<SentryContext, 'module'> & { table?: string; operation?: string }
  ): void {
    this.captureException(error, {
      ...context,
      module: 'database',
      tags: {
        ...context.tags,
        error_type: 'database_error',
        db_operation: context.operation || 'unknown',
        db_table: context.table || 'unknown',
      },
    });
  }

  static captureApiError(
    error: Error | unknown,
    context: Omit<SentryContext, 'module'> & { endpoint?: string; method?: string; statusCode?: number }
  ): void {
    this.captureException(error, {
      ...context,
      module: 'api',
      tags: {
        ...context.tags,
        error_type: 'api_error',
        http_method: context.method || 'unknown',
        http_status: context.statusCode?.toString() || 'unknown',
      },
      extra: {
        ...context.extra,
        endpoint: context.endpoint,
        status_code: context.statusCode,
      },
    });
  }
}