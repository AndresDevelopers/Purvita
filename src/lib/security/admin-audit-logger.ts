/**
 * Admin Audit Logger
 *
 * Centralized logging for admin actions to ensure comprehensive audit trail
 */

import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';
import type { User } from '@supabase/supabase-js';

export interface AdminActionContext {
  adminId: string;
  adminEmail?: string;
  endpoint: string;
  method: string;
  targetResource?: string;
  targetId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log admin read operation (GET)
 */
export async function logAdminRead(
  resource: string,
  user: User,
  details?: Record<string, any>
): Promise<void> {
  await SecurityAuditLogger.log(
    SecurityEventType.ADMIN_ACTION,
    SecurityEventSeverity.INFO,
    `Admin viewed ${resource}`,
    {
      adminId: user.id,
      adminEmail: user.email,
      resource,
      action: 'READ',
      ...details,
    },
    false
  );
}

/**
 * Log admin create operation (POST)
 */
export async function logAdminCreate(
  resource: string,
  user: User,
  details?: Record<string, any>
): Promise<void> {
  await SecurityAuditLogger.log(
    SecurityEventType.ADMIN_ACTION,
    SecurityEventSeverity.WARNING,
    `Admin created ${resource}`,
    {
      adminId: user.id,
      adminEmail: user.email,
      resource,
      action: 'CREATE',
      ...details,
    },
    false
  );
}

/**
 * Log admin update operation (PUT/PATCH)
 */
export async function logAdminUpdate(
  resource: string,
  user: User,
  details?: Record<string, any>
): Promise<void> {
  await SecurityAuditLogger.log(
    SecurityEventType.ADMIN_ACTION,
    SecurityEventSeverity.WARNING,
    `Admin updated ${resource}`,
    {
      adminId: user.id,
      adminEmail: user.email,
      resource,
      action: 'UPDATE',
      ...details,
    },
    false
  );
}

/**
 * Log admin delete operation (DELETE)
 */
export async function logAdminDelete(
  resource: string,
  user: User,
  details?: Record<string, any>
): Promise<void> {
  await SecurityAuditLogger.log(
    SecurityEventType.ADMIN_ACTION,
    SecurityEventSeverity.CRITICAL,
    `Admin deleted ${resource}`,
    {
      adminId: user.id,
      adminEmail: user.email,
      resource,
      action: 'DELETE',
      ...details,
    },
    false
  );
}

/**
 * Log sensitive admin operation (config changes, security settings, etc.)
 */
export async function logSensitiveAdminAction(
  action: string,
  user: User,
  details?: Record<string, any>
): Promise<void> {
  await SecurityAuditLogger.log(
    SecurityEventType.ADMIN_ACTION,
    SecurityEventSeverity.HIGH,
    `Admin performed sensitive action: ${action}`,
    {
      adminId: user.id,
      adminEmail: user.email,
      action,
      ...details,
    },
    false
  );
}

/**
 * Log admin bulk operation
 */
export async function logAdminBulkAction(
  action: string,
  resource: string,
  count: number,
  user: User,
  details?: Record<string, any>
): Promise<void> {
  await SecurityAuditLogger.log(
    SecurityEventType.ADMIN_ACTION,
    SecurityEventSeverity.HIGH,
    `Admin performed bulk ${action} on ${count} ${resource}`,
    {
      adminId: user.id,
      adminEmail: user.email,
      action: `BULK_${action.toUpperCase()}`,
      resource,
      count,
      ...details,
    },
    false
  );
}
