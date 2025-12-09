/**
 * Admin Alert System
 *
 * Sends real-time alerts for critical security events
 * Supports multiple notification channels (email, Slack, webhook)
 */

import { SecurityEventSeverity } from './audit-logger';
import type { SuspiciousActivity } from './admin-activity-monitor';

export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  severity: SecurityEventSeverity;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'console';
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface Alert {
  id: string;
  type: 'security' | 'suspicious_activity' | 'system';
  severity: SecurityEventSeverity;
  title: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
}

// Alert configuration (should be loaded from database in production)
const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  channels: [
    {
      type: 'console',
      enabled: true,
      config: {},
    },
  ],
  severity: SecurityEventSeverity.WARNING,
};

/**
 * Send an alert
 */
export async function sendAlert(alert: Alert): Promise<void> {
  const config = await getAlertConfig();

  // Check if alerts are enabled
  if (!config.enabled) {
    return;
  }

  // Check if severity meets threshold
  const severityLevel = getSeverityLevel(alert.severity);
  const thresholdLevel = getSeverityLevel(config.severity);

  if (severityLevel < thresholdLevel) {
    return;
  }

  // Send to all enabled channels
  const promises = config.channels
    .filter(channel => channel.enabled)
    .map(channel => sendToChannel(alert, channel));

  await Promise.allSettled(promises);
}

/**
 * Send alert for suspicious activity
 */
export async function sendSuspiciousActivityAlert(
  suspicious: SuspiciousActivity
): Promise<void> {
  const alert: Alert = {
    id: generateAlertId(),
    type: 'suspicious_activity',
    severity: suspicious.severity === 'critical' ? SecurityEventSeverity.CRITICAL :
              suspicious.severity === 'high' ? SecurityEventSeverity.ERROR :
              suspicious.severity === 'medium' ? SecurityEventSeverity.WARNING :
              SecurityEventSeverity.INFO,
    title: `Suspicious Activity Detected: ${suspicious.type}`,
    message: suspicious.description,
    details: {
      ...suspicious.details,
      userId: suspicious.userId,
      type: suspicious.type,
    },
    timestamp: suspicious.timestamp,
  };

  await sendAlert(alert);
}

/**
 * Send security alert
 */
export async function sendSecurityAlert(
  title: string,
  message: string,
  severity: SecurityEventSeverity,
  details: Record<string, unknown> = {}
): Promise<void> {
  const alert: Alert = {
    id: generateAlertId(),
    type: 'security',
    severity,
    title,
    message,
    details,
    timestamp: Date.now(),
  };

  await sendAlert(alert);
}

/**
 * Send alert to a specific channel
 */
async function sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
  try {
    switch (channel.type) {
      case 'email':
        await sendEmailAlert(alert, channel.config);
        break;

      case 'slack':
        await sendSlackAlert(alert, channel.config);
        break;

      case 'webhook':
        await sendWebhookAlert(alert, channel.config);
        break;

      case 'console':
        sendConsoleAlert(alert);
        break;

      default:
        console.warn(`[AlertSystem] Unknown channel type: ${channel.type}`);
    }
  } catch (error) {
    console.error(`[AlertSystem] Error sending to ${channel.type}:`, error);
  }
}

/**
 * Send email alert
 */
async function sendEmailAlert(
  alert: Alert,
  config: Record<string, unknown>
): Promise<void> {
  const recipients = config.recipients as string[] | undefined;

  if (!recipients || recipients.length === 0) {
    console.warn('[AlertSystem] No email recipients configured');
    return;
  }

  // TODO: Implement email sending
  console.log('[AlertSystem] Email alert would be sent to:', recipients);
  console.log('[AlertSystem] Alert:', formatAlertForEmail(alert));
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(
  alert: Alert,
  config: Record<string, unknown>
): Promise<void> {
  const webhookUrl = config.webhookUrl as string | undefined;

  if (!webhookUrl) {
    console.warn('[AlertSystem] No Slack webhook URL configured');
    return;
  }

  const payload = {
    text: `🚨 ${alert.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: getSeverityEmoji(alert.severity) + ' ' + alert.title,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alert.message,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${alert.severity}`,
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${alert.type}`,
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${new Date(alert.timestamp).toISOString()}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error('[AlertSystem] Error sending Slack alert:', error);
  }
}

/**
 * Send webhook alert
 */
async function sendWebhookAlert(
  alert: Alert,
  config: Record<string, unknown>
): Promise<void> {
  const url = config.url as string | undefined;

  if (!url) {
    console.warn('[AlertSystem] No webhook URL configured');
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PurVita-AlertSystem/1.0',
      },
      body: JSON.stringify(alert),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error('[AlertSystem] Error sending webhook alert:', error);
  }
}

/**
 * Send console alert (for development/debugging)
 */
function sendConsoleAlert(alert: Alert): void {
  const emoji = getSeverityEmoji(alert.severity);
  const timestamp = new Date(alert.timestamp).toISOString();

  console.warn('\n' + '='.repeat(80));
  console.warn(`${emoji} ALERT: ${alert.title}`);
  console.warn('='.repeat(80));
  console.warn(`Type: ${alert.type}`);
  console.warn(`Severity: ${alert.severity}`);
  console.warn(`Time: ${timestamp}`);
  console.warn(`Message: ${alert.message}`);

  if (Object.keys(alert.details).length > 0) {
    console.warn('\nDetails:');
    console.warn(JSON.stringify(alert.details, null, 2));
  }

  console.warn('='.repeat(80) + '\n');
}

/**
 * Get alert configuration
 */
async function getAlertConfig(): Promise<AlertConfig> {
  // TODO: Load from database
  return DEFAULT_ALERT_CONFIG;
}

/**
 * Get severity level as number for comparison
 */
function getSeverityLevel(severity: SecurityEventSeverity): number {
  const levels = {
    [SecurityEventSeverity.INFO]: 0,
    [SecurityEventSeverity.WARNING]: 1,
    [SecurityEventSeverity.ERROR]: 2,
    [SecurityEventSeverity.CRITICAL]: 3,
  };

  return levels[severity] ?? 0;
}

/**
 * Get emoji for severity
 */
function getSeverityEmoji(severity: SecurityEventSeverity): string {
  const emojis = {
    [SecurityEventSeverity.INFO]: 'ℹ️',
    [SecurityEventSeverity.WARNING]: '⚠️',
    [SecurityEventSeverity.ERROR]: '🔴',
    [SecurityEventSeverity.CRITICAL]: '🚨',
  };

  return emojis[severity] ?? '❓';
}

/**
 * Format alert for email
 */
function formatAlertForEmail(alert: Alert): string {
  return `
Alert: ${alert.title}

Type: ${alert.type}
Severity: ${alert.severity}
Time: ${new Date(alert.timestamp).toISOString()}

Message:
${alert.message}

Details:
${JSON.stringify(alert.details, null, 2)}
  `.trim();
}

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
