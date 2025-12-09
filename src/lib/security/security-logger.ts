/**
 * Centralized Security Event Logger
 * 
 * Logs security events to database and sends alerts for critical events
 */

import { createAdminClient } from '@/lib/supabase/server';

export type SecurityEventType =
  | 'csrf_failed'
  | 'file_upload_rejected'
  | 'suspicious_activity'
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'invalid_input'
  | 'authentication_failed'
  | 'privilege_escalation_attempt';

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  details: Record<string, any>;
}

export class SecurityLogger {
  /**
   * Log a security event
   */
  static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const adminClient = await createAdminClient();

      // Insert into audit_logs table (security_events is a view based on this)
      const { error } = await adminClient
        .from('audit_logs')
        .insert({
          user_id: event.userId || null,
          action: event.type.toUpperCase(),
          entity_type: 'security',
          entity_id: null,
          ip_address: event.ipAddress || null,
          user_agent: event.userAgent || null,
          status: event.severity === 'critical' || event.severity === 'high' ? 'error' : 'success',
          metadata: {
            severity: event.severity,
            request_path: event.requestPath,
            request_method: event.requestMethod,
            ...event.details
          },
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('[SecurityLogger] Failed to log security event:', error);
      }

      // Send alert for critical events
      if (event.severity === 'critical') {
        await this.sendSecurityAlert(event);
      }
    } catch (error) {
      console.error('[SecurityLogger] Error logging security event:', error);
    }
  }

  /**
   * Send security alert for critical events
   */
  private static async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      // Log to console for immediate visibility
      console.error('[SECURITY ALERT]', {
        type: event.type,
        severity: event.severity,
        userId: event.userId,
        ipAddress: event.ipAddress,
        details: event.details
      });

      // TODO: Implement email/Slack/webhook notifications
      // Example: Send to Slack webhook
      const webhookUrl = process.env.SECURITY_ALERT_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Security Alert: ${event.type}`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Severity', value: event.severity, short: true },
                { title: 'User ID', value: event.userId || 'N/A', short: true },
                { title: 'IP Address', value: event.ipAddress || 'N/A', short: true },
                { title: 'Path', value: event.requestPath || 'N/A', short: true },
                { title: 'Details', value: JSON.stringify(event.details), short: false }
              ]
            }]
          })
        });
      }
    } catch (error) {
      console.error('[SecurityLogger] Failed to send security alert:', error);
    }
  }

  /**
   * Log CSRF validation failure
   */
  static async logCsrfFailed(data: {
    userId?: string;
    ipAddress?: string;
    requestPath?: string;
    requestMethod?: string;
    reason: string;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: 'csrf_failed',
      severity: 'high',
      userId: data.userId,
      ipAddress: data.ipAddress,
      requestPath: data.requestPath,
      requestMethod: data.requestMethod,
      details: { reason: data.reason }
    });
  }

  /**
   * Log file upload rejection
   */
  static async logFileUploadRejected(data: {
    userId?: string;
    ipAddress?: string;
    filename: string;
    fileType: string;
    fileSize: number;
    reason: string;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: 'file_upload_rejected',
      severity: 'medium',
      userId: data.userId,
      ipAddress: data.ipAddress,
      details: {
        filename: data.filename,
        fileType: data.fileType,
        fileSize: data.fileSize,
        reason: data.reason
      }
    });
  }

  /**
   * Log unauthorized access attempt
   */
  static async logUnauthorizedAccess(data: {
    userId?: string;
    ipAddress?: string;
    requestPath?: string;
    requestMethod?: string;
    requiredRole?: string;
    userRole?: string;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: 'unauthorized_access',
      severity: 'high',
      userId: data.userId,
      ipAddress: data.ipAddress,
      requestPath: data.requestPath,
      requestMethod: data.requestMethod,
      details: {
        requiredRole: data.requiredRole,
        userRole: data.userRole
      }
    });
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(data: {
    userId?: string;
    ipAddress?: string;
    activityType: string;
    details: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: 'suspicious_activity',
      severity: 'high',
      userId: data.userId,
      ipAddress: data.ipAddress,
      details: {
        activityType: data.activityType,
        ...data.details
      }
    });
  }
}
