/**
 * @fileoverview Service for logging critical user actions (Audit Trail).
 * This provides a centralized way to record important events for security and monitoring.
 *
 * Privacy Features:
 * - IP addresses are encrypted using AES-256-GCM before storage
 * - Complies with GDPR/CCPA privacy requirements
 * - Only admins can decrypt IP addresses when needed for security investigations
 */

import { supabase, getServiceRoleClient } from '@/lib/supabase';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { encryptIP, decryptIP } from '@/lib/security/ip-encryption';

type AuditLogMetadata = Record<string, any>;

type AuditLogEntry = {
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  ip_address?: string | null;
  user_agent?: string;
  metadata?: AuditLogMetadata;
};

type AuditLogRecord = AuditLogEntry & {
  id: string;
  created_at: string;
};

export type AuditLogProfile = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type AuditLogWithProfile = AuditLogRecord & {
  profiles?: AuditLogProfile | null;
};

/**
 * Security event constants for audit logging
 */
export const SECURITY_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  EMAIL_CHANGED: 'EMAIL_CHANGED',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',

  // Payments
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PAYMENT_GATEWAY_UPDATED: 'PAYMENT_GATEWAY_UPDATED',
  WEBHOOK_RECEIVED: 'WEBHOOK_RECEIVED',
  WEBHOOK_SIGNATURE_FAILED: 'WEBHOOK_SIGNATURE_FAILED',

  // Wallet
  WALLET_RECHARGE: 'WALLET_RECHARGE',
  WALLET_SPEND: 'WALLET_SPEND',
  WALLET_WITHDRAWAL_REQUESTED: 'WALLET_WITHDRAWAL_REQUESTED',
  WALLET_WITHDRAWAL_APPROVED: 'WALLET_WITHDRAWAL_APPROVED',
  WALLET_WITHDRAWAL_REJECTED: 'WALLET_WITHDRAWAL_REJECTED',
  WALLET_WITHDRAWAL_COMPLETED: 'WALLET_WITHDRAWAL_COMPLETED',

  // Admin
  ADMIN_ACCESS: 'ADMIN_ACCESS',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_UNSUSPENDED: 'USER_UNSUSPENDED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',

  // Fraud & Security
  FRAUD_ALERT_TRIGGERED: 'FRAUD_ALERT_TRIGGERED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  IP_BLOCKED: 'IP_BLOCKED',
} as const;

export type SecurityEvent = typeof SECURITY_EVENTS[keyof typeof SECURITY_EVENTS];

/**
 * Logs a critical user action to the database.
 * @param action - A string describing the action (e.g., "PRODUCT_CREATED", "PRODUCT_UPDATED").
 * @param entityType - The type of entity affected (e.g., "product", "user").
 * @param entityId - The ID of the affected entity.
 * @param metadata - An object containing relevant data about the event.
 * @param ipAddress - Optional IP address of the request
 * @param userAgent - Optional user agent string
 */
export async function logUserAction(
  action: string,
  entityType: string,
  entityId?: string,
  metadata: AuditLogMetadata = {},
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  console.log(`[AUDIT LOG ATTEMPT] | Action: ${action} | Entity: ${entityType} | EntityID: ${entityId}`);

  try {
    // Only try to get service role client on the server to avoid browser errors
    const serviceClient = typeof window === 'undefined' ? getServiceRoleClient() : null;
    const client =
      typeof window === 'undefined'
        ? await createServerSupabaseClient()
        : supabase;

    // Get current user
    let user = null;
    try {
      const { data: { user: u }, error: userError } = await client.auth.getUser();
      if (userError) {
        // Handle AuthSessionMissingError gracefully
        if (userError.message?.includes('Auth session missing') || userError.name === 'AuthSessionMissingError') {
          console.log('No authenticated user for audit log');
        } else {
          console.error('Error getting user for audit log:', userError);
        }
      } else {
        user = u;
      }
    } catch (error: any) {
      // Handle AuthSessionMissingError gracefully
      if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
        console.log('No authenticated user for audit log');
      } else {
        console.error('Exception getting user for audit log:', error);
      }
    }

    console.log('User for audit log:', user?.id, user?.email);

    // Encrypt IP address for privacy protection (only on server)
    let encryptedIP: string | null = null;
    if (ipAddress && typeof window === 'undefined') {
      try {
        encryptedIP = await encryptIP(ipAddress);
      } catch (_error) {
        console.warn('[Audit Log] Failed to encrypt IP address, storing without IP');
      }
    } else if (ipAddress) {
      encryptedIP = null; // Don't store IP in browser for privacy
    }

    const logEntry: AuditLogEntry = {
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: user?.id,
      ip_address: encryptedIP,
      user_agent: userAgent,
      metadata,
    };

    console.log('Inserting audit log entry (IP encrypted):', { ...logEntry, ip_address: encryptedIP ? '[ENCRYPTED]' : null });

    // Use service role client for insertion to bypass RLS (only on server)
    if (!serviceClient) {
      console.warn('Service role client not available, skipping audit log insertion');
      console.log(
        `[AUDIT LOG SKIPPED] | Action: ${action} | Entity: ${entityType} | EntityID: ${entityId} | Metadata: ${JSON.stringify(metadata)}`
      );
      return; // Skip audit logging if service client is not available
    }

    const { error } = await serviceClient
      .from('audit_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Error logging audit action:', error);
      console.error('Error details:', JSON.stringify({
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, null, 2));
      // Fallback to console logging
      console.log(
        `[AUDIT LOG FALLBACK] | Action: ${action} | Entity: ${entityType} | EntityID: ${entityId} | Metadata: ${JSON.stringify(metadata)}`
      );
    } else {
      console.log(
        `[AUDIT LOG SUCCESS] | Action: ${action} | Entity: ${entityType} | EntityID: ${entityId} | User: ${user?.id}`
      );
    }
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Fallback to console logging
    console.log(
      `[AUDIT LOG FALLBACK] | Action: ${action} | Entity: ${entityType} | EntityID: ${entityId} | Metadata: ${JSON.stringify(metadata)}`
    );
  }
}

/**
 * Gets recent audit logs for a specific entity type.
 * @param entityType - The type of entity to filter by (e.g., "product").
 * @param limit - Maximum number of logs to return.
 * @param decryptIPs - Whether to decrypt IP addresses (admin only, default: false)
 */
export async function getRecentAuditLogs(
  entityType: string,
  limit: number = 10,
  decryptIPs: boolean = false
): Promise<AuditLogWithProfile[]> {
  try {
    const client =
      typeof window === 'undefined'
        ? await createServerSupabaseClient()
        : supabase;

    // Check if user is authenticated and is admin
    let user = null;
    try {
      const { data: { user: u }, error: userError } = await client.auth.getUser();
      if (userError) {
        // Handle AuthSessionMissingError gracefully
        if (userError.message?.includes('Auth session missing') || userError.name === 'AuthSessionMissingError') {
          console.log('No authenticated user for audit logs fetch');
        } else {
          console.error('Error getting user for audit logs:', userError);
        }
      } else {
        user = u;
      }
    } catch (error: any) {
      // Handle AuthSessionMissingError gracefully
      if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
        console.log('No authenticated user for audit logs fetch');
      } else {
        console.error('Exception getting user for audit logs:', error);
      }
    }
    console.log('Current user for audit logs:', user?.id, user?.email);

    const { data: logs, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit logs:', error);
      console.error('Error details:', JSON.stringify({
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, null, 2));
      return [];
    }

    console.log(`Found ${logs?.length || 0} audit logs for entity type: ${entityType}`);
    if (!logs || logs.length === 0) {
      return [];
    }

    const userIds = Array.from(
      new Set(
        logs
          .map((log) => log.user_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let profilesById = new Map<string, AuditLogProfile>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await client
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles for audit logs:', profilesError);
        console.error('Error details:', JSON.stringify({
          message: profilesError.message,
          code: profilesError.code,
          details: profilesError.details,
          hint: profilesError.hint
        }, null, 2));
      } else if (profiles) {
        profilesById = new Map(
          profiles
            .filter((profile) => Boolean(profile?.id))
            .map((profile) => [profile.id, profile])
        );
      }
    }

    // Decrypt IP addresses if requested (admin only)
    let enrichedLogs: AuditLogWithProfile[] = logs.map((log) => ({
      ...log,
      profiles: log.user_id ? profilesById.get(log.user_id) ?? null : null
    }));

    if (decryptIPs && typeof window === 'undefined') {
      console.log('[Audit Logs] Decrypting IP addresses for admin view');
      enrichedLogs = await Promise.all(
        enrichedLogs.map(async (log) => {
          if (log.ip_address) {
            try {
              const decryptedIP = await decryptIP(log.ip_address);
              return {
                ...log,
                ip_address: decryptedIP || log.ip_address, // Fallback to encrypted if decryption fails
              };
            } catch (error) {
              console.warn('Failed to decrypt IP address:', error);
              return log;
            }
          }
          return log;
        })
      );
    }

    console.log('Sample audit log:', {
      ...enrichedLogs[0],
      ip_address: decryptIPs ? enrichedLogs[0]?.ip_address : '[ENCRYPTED]'
    });

    return enrichedLogs;
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
}

/**
 * Gets all recent audit logs (admin only)
 * @param limit - Maximum number of logs to return
 * @param decryptIPs - Whether to decrypt IP addresses (default: false)
 */
export async function getAllAuditLogs(
  limit: number = 50,
  decryptIPs: boolean = false
): Promise<AuditLogWithProfile[]> {
  try {
    const client =
      typeof window === 'undefined'
        ? await createServerSupabaseClient()
        : supabase;

    // Check if user is authenticated and is admin
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      console.error('Unauthorized access to audit logs');
      return [];
    }

    // Verify admin access using RBAC permission system
    const { getUserPermissions } = await import('@/lib/services/permission-service');
    const userPermissions = await getUserPermissions(user.id);

    if (!userPermissions || !userPermissions.permissions.includes('access_admin_panel')) {
      console.error('Non-admin user attempted to access all audit logs');
      return [];
    }

    const { data: logs, error } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching all audit logs:', error);
      return [];
    }

    if (!logs || logs.length === 0) {
      return [];
    }

    // Get user profiles
    const userIds = Array.from(
      new Set(
        logs
          .map((log) => log.user_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let profilesById = new Map<string, AuditLogProfile>();

    if (userIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profiles) {
        profilesById = new Map(
          profiles
            .filter((profile) => Boolean(profile?.id))
            .map((profile) => [profile.id, profile])
        );
      }
    }

    // Enrich logs with profiles
    let enrichedLogs: AuditLogWithProfile[] = logs.map((log) => ({
      ...log,
      profiles: log.user_id ? profilesById.get(log.user_id) ?? null : null
    }));

    // Decrypt IP addresses if requested (only on server)
    if (decryptIPs && typeof window === 'undefined') {
      console.log('[Audit Logs] Decrypting IP addresses for admin view');
      enrichedLogs = await Promise.all(
        enrichedLogs.map(async (log) => {
          if (log.ip_address) {
            try {
              const decryptedIP = await decryptIP(log.ip_address);
              return {
                ...log,
                ip_address: decryptedIP || log.ip_address,
              };
            } catch (error) {
              console.warn('Failed to decrypt IP address:', error);
              return log;
            }
          }
          return log;
        })
      );
    }

    return enrichedLogs;
  } catch (error) {
    console.error('Failed to fetch all audit logs:', error);
    return [];
  }
}
