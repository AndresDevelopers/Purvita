/**
 * Admin Activity Monitor
 *
 * Real-time monitoring of admin activities
 * Detects suspicious behavior and triggers alerts
 */

import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';
import { getAdminClient } from '@/lib/supabase/admin';

export interface AdminActivity {
  userId: string;
  action: string;
  endpoint: string;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
}

export interface SuspiciousActivity {
  type: 'rapid_requests' | 'unusual_time' | 'new_ip' | 'bulk_operations' | 'privilege_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  description: string;
  details: Record<string, unknown>;
  timestamp: number;
}

// In-memory activity tracking (consider Redis for production)
const activityLog = new Map<string, AdminActivity[]>();
const MAX_ACTIVITY_LOG_SIZE = 1000;

// Suspicious activity thresholds
const THRESHOLDS = {
  // More than 10 requests in 10 seconds
  rapidRequests: {
    count: 10,
    windowMs: 10 * 1000,
  },

  // More than 5 failed permission checks in 5 minutes
  failedPermissions: {
    count: 5,
    windowMs: 5 * 60 * 1000,
  },

  // Access outside business hours (10 PM - 6 AM)
  unusualHours: {
    startHour: 22, // 10 PM
    endHour: 6,    // 6 AM
  },

  // More than 20 bulk operations in 1 minute
  bulkOperations: {
    count: 20,
    windowMs: 60 * 1000,
  },
};

/**
 * Log admin activity
 */
export function logAdminActivity(activity: AdminActivity): void {
  const key = activity.userId;
  const activities = activityLog.get(key) || [];

  // Add new activity
  activities.push(activity);

  // Keep only recent activities (memory management)
  if (activities.length > MAX_ACTIVITY_LOG_SIZE) {
    activities.shift();
  }

  activityLog.set(key, activities);

  // Check for suspicious activity
  detectSuspiciousActivity(activity);
}

/**
 * Detect suspicious activity patterns
 */
async function detectSuspiciousActivity(activity: AdminActivity): Promise<void> {
  const suspiciousActivities: SuspiciousActivity[] = [];

  // Check for rapid requests
  const rapidRequests = checkRapidRequests(activity.userId);
  if (rapidRequests) {
    suspiciousActivities.push(rapidRequests);
  }

  // Check for unusual time access
  const unusualTime = checkUnusualTimeAccess(activity);
  if (unusualTime) {
    suspiciousActivities.push(unusualTime);
  }

  // Check for new IP address
  const newIP = await checkNewIPAddress(activity);
  if (newIP) {
    suspiciousActivities.push(newIP);
  }

  // Check for bulk operations
  const bulkOps = checkBulkOperations(activity);
  if (bulkOps) {
    suspiciousActivities.push(bulkOps);
  }

  // Trigger alerts for suspicious activities
  for (const suspicious of suspiciousActivities) {
    await triggerSuspiciousActivityAlert(suspicious);
  }
}

/**
 * Check for rapid requests (potential bot or attack)
 */
function checkRapidRequests(userId: string): SuspiciousActivity | null {
  const activities = activityLog.get(userId) || [];
  const now = Date.now();
  const windowStart = now - THRESHOLDS.rapidRequests.windowMs;

  const recentActivities = activities.filter(a => a.timestamp >= windowStart);

  if (recentActivities.length >= THRESHOLDS.rapidRequests.count) {
    return {
      type: 'rapid_requests',
      severity: 'high',
      userId,
      description: `Admin user made ${recentActivities.length} requests in ${THRESHOLDS.rapidRequests.windowMs / 1000} seconds`,
      details: {
        requestCount: recentActivities.length,
        windowMs: THRESHOLDS.rapidRequests.windowMs,
        endpoints: recentActivities.map(a => a.endpoint),
      },
      timestamp: now,
    };
  }

  return null;
}

/**
 * Check for unusual time access (outside business hours)
 */
function checkUnusualTimeAccess(activity: AdminActivity): SuspiciousActivity | null {
  const date = new Date(activity.timestamp);
  const hour = date.getHours();

  const isUnusual = hour >= THRESHOLDS.unusualHours.startHour ||
                    hour < THRESHOLDS.unusualHours.endHour;

  if (isUnusual) {
    return {
      type: 'unusual_time',
      severity: 'medium',
      userId: activity.userId,
      description: `Admin access at unusual hour: ${hour}:${date.getMinutes()}`,
      details: {
        timestamp: activity.timestamp,
        hour,
        action: activity.action,
        endpoint: activity.endpoint,
      },
      timestamp: Date.now(),
    };
  }

  return null;
}

/**
 * Check for new IP address (potential account compromise)
 */
async function checkNewIPAddress(activity: AdminActivity): Promise<SuspiciousActivity | null> {
  try {
    const supabase = getAdminClient();

    // Get recent login IPs for this user
    const { data: recentLogins } = await supabase
      .from('admin_activity_log')
      .select('ip_address')
      .eq('user_id', activity.userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentLogins || recentLogins.length === 0) {
      // First login, not suspicious
      return null;
    }

    const knownIPs = new Set(recentLogins.map(l => l.ip_address));

    if (!knownIPs.has(activity.ipAddress)) {
      return {
        type: 'new_ip',
        severity: 'high',
        userId: activity.userId,
        description: `Admin access from new IP address: ${activity.ipAddress}`,
        details: {
          newIP: activity.ipAddress,
          knownIPs: Array.from(knownIPs),
          action: activity.action,
          endpoint: activity.endpoint,
        },
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.error('[AdminActivityMonitor] Error checking new IP:', error);
  }

  return null;
}

/**
 * Check for bulk operations (potential data exfiltration)
 */
function checkBulkOperations(activity: AdminActivity): SuspiciousActivity | null {
  const activities = activityLog.get(activity.userId) || [];
  const now = Date.now();
  const windowStart = now - THRESHOLDS.bulkOperations.windowMs;

  const bulkOps = activities.filter(a =>
    a.timestamp >= windowStart &&
    (a.action.includes('export') || a.action.includes('bulk') || a.action.includes('delete_all'))
  );

  if (bulkOps.length >= THRESHOLDS.bulkOperations.count) {
    return {
      type: 'bulk_operations',
      severity: 'critical',
      userId: activity.userId,
      description: `Admin performed ${bulkOps.length} bulk operations in ${THRESHOLDS.bulkOperations.windowMs / 1000} seconds`,
      details: {
        operationCount: bulkOps.length,
        operations: bulkOps.map(a => a.action),
        windowMs: THRESHOLDS.bulkOperations.windowMs,
      },
      timestamp: now,
    };
  }

  return null;
}

/**
 * Trigger alert for suspicious activity
 */
async function triggerSuspiciousActivityAlert(suspicious: SuspiciousActivity): Promise<void> {
  // Log to security audit
  await SecurityAuditLogger.log(
    SecurityEventType.SUSPICIOUS_ACTIVITY_DETECTED,
    suspicious.severity === 'critical' ? SecurityEventSeverity.CRITICAL :
    suspicious.severity === 'high' ? SecurityEventSeverity.ERROR :
    suspicious.severity === 'medium' ? SecurityEventSeverity.WARNING :
    SecurityEventSeverity.INFO,
    suspicious.description,
    {
      ...suspicious.details,
      suspiciousActivityType: suspicious.type,
      userId: suspicious.userId,
    },
    suspicious.severity === 'critical' || suspicious.severity === 'high'
  );

  // TODO: Send real-time notification (email, Slack, etc.)
  console.warn('[AdminActivityMonitor] Suspicious activity detected:', suspicious);
}

/**
 * Get recent admin activities for a user
 */
export function getRecentAdminActivities(
  userId: string,
  limit: number = 50
): AdminActivity[] {
  const activities = activityLog.get(userId) || [];
  return activities.slice(-limit);
}

/**
 * Clear activity log for a user
 */
export function clearAdminActivityLog(userId: string): void {
  activityLog.delete(userId);
}

/**
 * Get all suspicious activities in the last N minutes
 */
export async function getRecentSuspiciousActivities(
  minutes: number = 60
): Promise<SuspiciousActivity[]> {
  try {
    const supabase = getAdminClient();
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const { data, error } = await supabase
      .from('security_audit_log')
      .select('*')
      .eq('event_type', SecurityEventType.SUSPICIOUS_ACTIVITY_DETECTED)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminActivityMonitor] Error fetching suspicious activities:', error);
      return [];
    }

    return (data || []).map(record => ({
      type: record.metadata?.suspiciousActivityType || 'unknown',
      severity: record.severity,
      userId: record.metadata?.userId || 'unknown',
      description: record.message,
      details: record.metadata || {},
      timestamp: new Date(record.created_at).getTime(),
    }));
  } catch (error) {
    console.error('[AdminActivityMonitor] Error in getRecentSuspiciousActivities:', error);
    return [];
  }
}
