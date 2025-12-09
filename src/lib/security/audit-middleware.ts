import { NextRequest, NextResponse } from 'next/server';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';

/**
 * Extracts client IP address from request headers
 */
function getClientIP(request: NextRequest): string | null {
  // Try common proxy headers in order of reliability
  const headers = request.headers;
  
  const ipHeaders = [
    'x-client-ip',
    'x-forwarded-for',
    'cf-connecting-ip',
    'true-client-ip',
    'x-real-ip',
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];

  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      // Handle X-Forwarded-For format: client, proxy1, proxy2
      const ips = value.split(',').map(ip => ip.trim());
      return ips[0]; // Return the first (client) IP
    }
  }

  // Fallback to remote address (less reliable behind proxies)
  const remoteAddr = request.headers.get('x-remote-address') || 
                     (request as any).socket?.remoteAddress;
  
  return remoteAddr || null;
}

/**
 * Audit Middleware for automatic logging of critical operations
 */

export interface AuditMiddlewareConfig {
  /** Whether to log all requests */
  logAllRequests?: boolean;
  /** Path patterns to include for logging */
  includePatterns?: RegExp[];
  /** Path patterns to exclude from logging */
  excludePatterns?: RegExp[];
  /** Sensitive parameters to redact */
  sensitiveParams?: string[];
  /** Headers to redact */
  sensitiveHeaders?: string[];
}

const DEFAULT_CONFIG: AuditMiddlewareConfig = {
  logAllRequests: false,
  includePatterns: [
    /^\/api\/admin/,
    /^\/api\/auth/,
    /^\/api\/payments/,
    /^\/api\/users/,
    /^\/api\/security/,
  ],
  excludePatterns: [
    /^\/api\/health/,
    /^\/_next/,
    /^\/static/,
  ],
  sensitiveParams: [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'creditCard',
    'cvv',
    'ssn',
  ],
  sensitiveHeaders: [
    'authorization',
    'cookie',
    'set-cookie',
  ],
};

export class AuditMiddleware {
  private config: AuditMiddlewareConfig;

  constructor(config: Partial<AuditMiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a path should be logged
   */
  private shouldLogPath(pathname: string): boolean {
    if (this.config.logAllRequests) {
      return true;
    }

    // Check exclude patterns first
    if (this.config.excludePatterns?.some(pattern => pattern.test(pathname))) {
      return false;
    }

    // Check include patterns
    return this.config.includePatterns?.some(pattern => pattern.test(pathname)) ?? false;
  }

  /**
   * Redact sensitive information from objects
   */
  private redactSensitiveData(obj: Record<string, any>): Record<string, any> {
    const redacted = { ...obj };

    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();
      
      if (this.config.sensitiveParams?.some(param => 
        lowerKey.includes(param.toLowerCase())
      )) {
        redacted[key] = '***REDACTED***';
      }
    }

    return redacted;
  }

  /**
   * Redact sensitive headers
   */
  private redactHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted = { ...headers };

    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();
      
      if (this.config.sensitiveHeaders?.some(header => 
        lowerKey.includes(header.toLowerCase())
      )) {
        redacted[key] = '***REDACTED***';
      }
    }

    return redacted;
  }

  /**
   * Extract request metadata for logging
   */
  private async extractRequestMetadata(request: NextRequest): Promise<{
    method: string;
    path: string;
    query: Record<string, any>;
    headers: Record<string, string>;
    clientIP: string | undefined;
    userAgent: string | undefined;
    body?: any;
  }> {
    const url = new URL(request.url);
    
    let body: any = undefined;
    
    try {
      // Try to parse JSON body if available
      if (request.body && 
          request.headers.get('content-type')?.includes('application/json')) {
        body = await request.clone().json();
      }
    } catch {
      // Ignore body parsing errors
    }

    return {
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(request.headers),
      clientIP: getClientIP(request) || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      body,
    };
  }

  /**
   * Main middleware function
   */
  async handle(
    request: NextRequest,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;
    
    if (!this.shouldLogPath(pathname)) {
      return next();
    }

    const startTime = Date.now();
    let response: NextResponse = NextResponse.next();
    let error: any = null;

    try {
      // Extract request metadata before processing
      const requestMetadata = await this.extractRequestMetadata(request);
      
      // Redact sensitive data
      const safeMetadata = {
        ...requestMetadata,
        query: this.redactSensitiveData(requestMetadata.query),
        headers: this.redactHeaders(requestMetadata.headers),
        body: requestMetadata.body ? this.redactSensitiveData(requestMetadata.body) : undefined,
      };

      // Log request start
      await SecurityAuditLogger.log(
        SecurityEventType.NETWORK_REQUEST,
        SecurityEventSeverity.INFO,
        `Request started: ${request.method} ${pathname}`,
        {
          ...safeMetadata,
          timestamp: new Date().toISOString(),
        },
        true
      );

      // Process the request
      response = await next();

    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      const status = response?.status || (error ? 500 : 200);

      // Determine event type based on status code
      let eventType: SecurityEventType;
      let severity: SecurityEventSeverity;

      if (status >= 500) {
        eventType = SecurityEventType.ERROR_OCCURRED;
        severity = SecurityEventSeverity.ERROR;
      } else if (status >= 400) {
        eventType = SecurityEventType.ACCESS_DENIED;
        severity = SecurityEventSeverity.WARNING;
      } else {
        eventType = SecurityEventType.API_ACCESS;
        severity = SecurityEventSeverity.INFO;
      }

      // Log request completion
      await SecurityAuditLogger.log(
        eventType,
        severity,
        `Request completed: ${request.method} ${pathname} - ${status} (${duration}ms)`,
        {
          method: request.method,
          path: pathname,
          statusCode: status,
          durationMs: duration,
          timestamp: new Date().toISOString(),
          error: error ? error.message : undefined,
        },
        status < 400
      );
    }

    return response;
  }

  /**
   * Create a middleware wrapper for Next.js API routes
   */
  static createMiddleware(config?: Partial<AuditMiddlewareConfig>) {
    const middleware = new AuditMiddleware(config);

    return (request: NextRequest) => {
      return middleware.handle(request, async () => {
        // This would be replaced with the actual route handler
        // For API routes, we need to integrate with Next.js routing
        return NextResponse.next();
      });
    };
  }

  /**
   * Log specific security events with automatic metadata
   */
  async logSecurityEvent(
    type: SecurityEventType,
    message: string,
    metadata?: Record<string, any>,
    severity: SecurityEventSeverity = SecurityEventSeverity.INFO
  ) {
    await SecurityAuditLogger.log(
      type,
      severity,
      message,
      {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
      severity !== SecurityEventSeverity.ERROR && severity !== SecurityEventSeverity.CRITICAL
    );
  }
}

// Export singleton instance
export const auditMiddleware = new AuditMiddleware();

/**
 * Helper function to create audit middleware for specific routes
 */
export function withAuditLogging(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config?: Partial<AuditMiddlewareConfig>
): (request: NextRequest) => Promise<NextResponse> {
  const middleware = new AuditMiddleware(config);

  return async (request: NextRequest) => {
    return middleware.handle(request, () => handler(request));
  };
}