/**
 * Security Audit Logger
 *
 * Logs security-relevant events for monitoring and compliance
 * - Authentication events (login, logout, failed attempts)
 * - Authorization events (access denied, privilege escalation attempts)
 * - Data access events (sensitive data access, modifications)
 * - System events (configuration changes, security policy updates)
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Security event types
 */
export enum SecurityEventType {
  // Authentication Events
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  SESSION_CREATED = 'session_created',
  SESSION_DESTROYED = 'session_destroyed',
  SESSION_TIMEOUT = 'session_timeout',
  
  // Password Management
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  PASSWORD_CHANGED = 'password_changed',
  
  // Multi-Factor Authentication (MFA)
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_VERIFICATION_SUCCESS = 'mfa_verification_success',
  MFA_VERIFICATION_FAILED = 'mfa_verification_failed',
  MFA_ENROLLMENT_STARTED = 'mfa_enrollment_started',
  MFA_CHALLENGE_CREATED = 'mfa_challenge_created',
  
  // User Management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_SUSPENDED = 'user_suspended',
  USER_REACTIVATED = 'user_reactivated',
  
  // Role and Permissions
  ROLE_CHANGED = 'role_changed',
  PERMISSION_CHANGED = 'permission_changed',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  
  // API and Access Control
  API_ACCESS = 'api_access',
  API_RATE_LIMIT = 'api_rate_limit',
  ACCESS_DENIED = 'access_denied',
  ACCESS_GRANTED = 'access_granted',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',

  // Security Events
  RATE_LIMIT_TRIGGERED = 'rate_limit_triggered',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SECURITY_SETTING_CHANGED = 'security_setting_changed',
  CONFIGURATION_CHANGED = 'configuration_changed',
  SECURITY_SCAN = 'security_scan',
  VULNERABILITY_DETECTED = 'vulnerability_detected',
  CSRF_TOKEN_VALIDATION_FAILED = 'csrf_token_validation_failed',
  FRAUD_DETECTED = 'fraud_detected',
  XSS_ATTEMPT_DETECTED = 'xss_attempt_detected',
  MALICIOUS_IP_BLOCKED = 'malicious_ip_blocked',
  MALICIOUS_URL_BLOCKED = 'malicious_url_blocked',
  THREAT_DETECTED = 'threat_detected',
  SUSPICIOUS_ACTIVITY_DETECTED = 'suspicious_activity_detected',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ADMIN_ACTION = 'admin_action',
  
  // Database Operations
  DATABASE_QUERY = 'database_query',
  DATABASE_UPDATE = 'database_update',
  DATABASE_DELETE = 'database_delete',
  DATABASE_INSERT = 'database_insert',
  
  // File Operations
  FILE_UPLOAD = 'file_upload',
  FILE_DOWNLOAD = 'file_download',
  FILE_DELETED = 'file_deleted',
  FILE_MODIFIED = 'file_modified',
  
  // Payment Operations
  PAYMENT_PROCESSED = 'payment_processed',
  PAYMENT_REFUNDED = 'payment_refunded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_DISPUTED = 'payment_disputed',
  
  // Subscription Management
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  
  // Communication
  EMAIL_SENT = 'email_sent',
  EMAIL_FAILED = 'email_failed',
  NOTIFICATION_SENT = 'notification_sent',
  SMS_SENT = 'sms_sent',
  
  // System Operations
  CACHE_CLEARED = 'cache_cleared',
  CACHE_UPDATED = 'cache_updated',
  BACKUP_CREATED = 'backup_created',
  BACKUP_RESTORED = 'backup_restored',
  BACKUP_FAILED = 'backup_failed',
  
  // System Maintenance
  SYSTEM_UPDATE = 'system_update',
  SYSTEM_RESTART = 'system_restart',
  MAINTENANCE_MODE_ENABLED = 'maintenance_mode_enabled',
  MAINTENANCE_MODE_DISABLED = 'maintenance_mode_disabled',
  
  // Error and Warning Events
  ERROR_OCCURRED = 'error_occurred',
  WARNING_OCCURRED = 'warning_occurred',
  INFO_MESSAGE = 'info_message',
  DEBUG_MESSAGE = 'debug_message',
  
  // Startup and Validation
  STARTUP_VALIDATION_PASSED = 'startup_validation_passed',
  STARTUP_VALIDATION_FAILED = 'startup_validation_failed',
  STARTUP_VALIDATION_WARNING = 'startup_validation_warning',
  
  // Secret Management
  SECRET_ROTATION_INITIATED = 'secret_rotation_initiated',
  SECRET_ROTATION_COMPLETED = 'secret_rotation_completed',
  SECRET_ROTATION_FAILED = 'secret_rotation_failed',
  SECRET_ACCESS = 'secret_access',
  
  // Network and Connectivity
  NETWORK_REQUEST = 'network_request',
  NETWORK_ERROR = 'network_error',
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_CLOSED = 'connection_closed',
  
  // Business Operations
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_COMPLETED = 'order_completed',
  
  INVENTORY_UPDATED = 'inventory_updated',
  INVENTORY_LOW = 'inventory_low',
  INVENTORY_OUT = 'inventory_out',
  
  SHIPMENT_CREATED = 'shipment_created',
  SHIPMENT_UPDATED = 'shipment_updated',
  SHIPMENT_DELIVERED = 'shipment_delivered',
  
  // Financial Operations
  TRANSACTION_CREATED = 'transaction_created',
  TRANSACTION_UPDATED = 'transaction_updated',
  TRANSACTION_REVERSED = 'transaction_reversed',
  
  // Compliance and Legal
  CONSENT_GIVEN = 'consent_given',
  CONSENT_REVOKED = 'consent_revoked',
  PRIVACY_REQUEST = 'privacy_request',
  GDPR_COMPLIANCE = 'gdpr_compliance',
  
  // Monitoring and Performance
  PERFORMANCE_METRIC = 'performance_metric',
  RESOURCE_USAGE = 'resource_usage',
  LATENCY_MEASUREMENT = 'latency_measurement',
  
  // Custom Business Events
  CUSTOM_EVENT = 'custom_event',
}

/**
 * Security event severity levels
 */
export enum SecurityEventSeverity {
  LOW = 'low',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Security event metadata
 */
export interface SecurityEventMetadata {
  // User information
  userId?: string
  userEmail?: string
  userRole?: string

  // Request information
  ipAddress?: string
  userAgent?: string
  requestPath?: string
  requestMethod?: string

  // Event-specific data
  resourceId?: string
  resourceType?: string
  action?: string
  previousValue?: string
  newValue?: string
  reason?: string

  // Additional context
  [key: string]: unknown
}

/**
 * Security audit log entry
 */
export interface SecurityAuditLog {
  id?: string
  timestamp: Date
  eventType: SecurityEventType
  severity: SecurityEventSeverity
  message: string
  metadata: SecurityEventMetadata
  success: boolean
}

/**
 * Security Audit Logger Service
 */
export class SecurityAuditLogger {
  /**
   * Logs a security event
   */
  static async log(
    eventType: SecurityEventType,
    severity: SecurityEventSeverity,
    message: string,
    metadata: SecurityEventMetadata = {},
    success: boolean = true
  ): Promise<void> {
    const logEntry: SecurityAuditLog = {
      timestamp: new Date(),
      eventType,
      severity,
      message,
      metadata,
      success,
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const logLevel =
        severity === SecurityEventSeverity.CRITICAL || severity === SecurityEventSeverity.ERROR
          ? 'error'
          : severity === SecurityEventSeverity.WARNING
            ? 'warn'
            : 'info'

      console[logLevel]('[SECURITY AUDIT]', {
        ...logEntry,
        timestamp: logEntry.timestamp.toISOString(),
      })
    }

    // Store in database
    try {
      await this.storeInDatabase(logEntry)
    } catch (error) {
      console.error('Failed to store security audit log:', error)
    }

    // Send alerts for critical events
    if (severity === SecurityEventSeverity.CRITICAL) {
      await this.sendAlert(logEntry)
    }
  }

  /**
   * Stores audit log in database
   */
  private static async storeInDatabase(log: SecurityAuditLog): Promise<void> {
    try {
      const supabase = await createClient()

      // Check if security_audit_logs table exists
      // If not, we'll just skip database storage
      const { error } = await supabase.from('security_audit_logs').insert({
        event_type: log.eventType,
        severity: log.severity,
        message: log.message,
        metadata: log.metadata,
        success: log.success,
        timestamp: log.timestamp.toISOString(),
        user_id: log.metadata.userId || null,
        ip_address: log.metadata.ipAddress || null,
      })

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = table doesn't exist
        console.error('Error storing security audit log:', error)
      }
    } catch (error) {
      // Silent fail - we don't want logging to break the application
      console.error('Security audit log storage error:', error)
    }
  }

  /**
   * Sends alert for critical security events
   */
  private static async sendAlert(log: SecurityAuditLog): Promise<void> {
    // TODO: Implement alert mechanism (email, Slack, PagerDuty, etc.)
    console.error('[CRITICAL SECURITY EVENT]', log)
  }

  /**
   * Helper methods for common security events
   */

  static async logLoginSuccess(userId: string, email: string, metadata: SecurityEventMetadata = {}) {
    await this.log(
      SecurityEventType.LOGIN_SUCCESS,
      SecurityEventSeverity.INFO,
      `User logged in successfully: ${email}`,
      { ...metadata, userId, userEmail: email },
      true
    )
  }

  static async logLoginFailure(email: string, reason: string, metadata: SecurityEventMetadata = {}) {
    await this.log(
      SecurityEventType.LOGIN_FAILED,
      SecurityEventSeverity.WARNING,
      `Login failed for ${email}: ${reason}`,
      { ...metadata, userEmail: email, reason },
      false
    )
  }

  static async logLogout(userId: string, metadata: SecurityEventMetadata = {}) {
    await this.log(
      SecurityEventType.LOGOUT,
      SecurityEventSeverity.INFO,
      `User logged out: ${userId}`,
      { ...metadata, userId },
      true
    )
  }

  static async logSessionTimeout(userId: string, metadata: SecurityEventMetadata = {}) {
    await this.log(
      SecurityEventType.SESSION_TIMEOUT,
      SecurityEventSeverity.INFO,
      `Session timed out for user: ${userId}`,
      { ...metadata, userId },
      true
    )
  }

  static async logAccessDenied(
    userId: string | undefined,
    resource: string,
    metadata: SecurityEventMetadata = {}
  ) {
    await this.log(
      SecurityEventType.ACCESS_DENIED,
      SecurityEventSeverity.WARNING,
      `Access denied to resource: ${resource}`,
      { ...metadata, userId, resourceId: resource },
      false
    )
  }

  static async logCsrfValidationFailed(metadata: SecurityEventMetadata = {}) {
    await this.log(
      SecurityEventType.CSRF_TOKEN_VALIDATION_FAILED,
      SecurityEventSeverity.WARNING,
      'CSRF token validation failed',
      metadata,
      false
    )
  }

  static async logRateLimitExceeded(identifier: string, metadata: SecurityEventMetadata = {}) {
    await this.log(
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      SecurityEventSeverity.WARNING,
      `Rate limit exceeded for: ${identifier}`,
      { ...metadata, identifier },
      false
    )
  }

  static async logFraudDetected(
    paymentId: string,
    reason: string,
    metadata: SecurityEventMetadata = {}
  ) {
    await this.log(
      SecurityEventType.FRAUD_DETECTED,
      SecurityEventSeverity.CRITICAL,
      `Potential fraud detected on payment ${paymentId}: ${reason}`,
      { ...metadata, resourceId: paymentId, reason },
      false
    )
  }

  static async logXssAttempt(payload: string, metadata: SecurityEventMetadata = {}) {
    await this.log(
      SecurityEventType.XSS_ATTEMPT_DETECTED,
      SecurityEventSeverity.CRITICAL,
      'XSS attempt detected',
      { ...metadata, payload: payload.substring(0, 100) }, // Truncate for safety
      false
    )
  }

  static async logAdminAction(
    userId: string,
    action: string,
    metadata: SecurityEventMetadata = {}
  ) {
    await this.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.INFO,
      `Admin action: ${action}`,
      { ...metadata, userId, action },
      true
    )
  }
}

/**
 * Request metadata extractor helper
 */
export function extractRequestMetadata(_request: Request): SecurityEventMetadata {
  const url = new URL(_request.url)

  return {
    ipAddress: _request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
    userAgent: _request.headers.get('user-agent') || 'unknown',
    requestPath: url.pathname,
    requestMethod: _request.method,
  }
}
