/**
 * Authorization Service
 * 
 * Core service for checking user permissions.
 * This is the STANDARD authorization system for the entire application.
 * 
 * IMPORTANT: This service is independent of any specific feature.
 * All parts of the application should use this for access control.
 */

import { createClient } from '@/lib/supabase/server';
import type { Permission } from '../models/permission';
import type { AuthorizationContext } from '../models/role';

/**
 * Get user's authorization context including their role and permissions
 */
export async function getAuthorizationContext(userId: string): Promise<AuthorizationContext | null> {
  try {
    const supabase = await createClient();

    // Get user profile with role_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // If user has no role assigned, they have no permissions
    if (!profile.role_id) {
      return {
        userId,
        roleId: null,
        roleName: null,
        permissions: [],
      };
    }

    // Get role with permissions
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id, name, permissions')
      .eq('id', profile.role_id)
      .single();

    if (roleError || !roleData) {
      return {
        userId,
        roleId: profile.role_id,
        roleName: null,
        permissions: [],
      };
    }

    return {
      userId,
      roleId: profile.role_id,
      roleName: roleData.name,
      permissions: roleData.permissions || [],
    };
  } catch (error) {
    console.error('[getAuthorizationContext] Error:', error);
    return null;
  }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  const context = await getAuthorizationContext(userId);
  return context?.permissions.includes(permission) ?? false;
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
  const context = await getAuthorizationContext(userId);
  if (!context) return false;
  return permissions.some(p => context.permissions.includes(p));
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
  const context = await getAuthorizationContext(userId);
  if (!context) return false;
  return permissions.every(p => context.permissions.includes(p));
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const context = await getAuthorizationContext(userId);
  return context?.permissions ?? [];
}

/**
 * Verify user has permission or throw error
 */
export async function requirePermission(userId: string, permission: Permission): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext(userId);
  
  if (!context) {
    throw new AuthorizationError('User not found', 'USER_NOT_FOUND');
  }
  
  if (!context.permissions.includes(permission)) {
    throw new AuthorizationError(
      `Permission denied: ${permission} required`,
      'PERMISSION_DENIED',
      permission
    );
  }
  
  return context;
}

/**
 * Verify user has any of the permissions or throw error
 */
export async function requireAnyPermission(userId: string, permissions: Permission[]): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext(userId);
  
  if (!context) {
    throw new AuthorizationError('User not found', 'USER_NOT_FOUND');
  }
  
  const hasAny = permissions.some(p => context.permissions.includes(p));
  
  if (!hasAny) {
    throw new AuthorizationError(
      `Permission denied: one of [${permissions.join(', ')}] required`,
      'PERMISSION_DENIED'
    );
  }
  
  return context;
}

/**
 * Verify user has all permissions or throw error
 */
export async function requireAllPermissions(userId: string, permissions: Permission[]): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext(userId);
  
  if (!context) {
    throw new AuthorizationError('User not found', 'USER_NOT_FOUND');
  }
  
  const hasAll = permissions.every(p => context.permissions.includes(p));
  
  if (!hasAll) {
    throw new AuthorizationError(
      `Permission denied: all of [${permissions.join(', ')}] required`,
      'PERMISSION_DENIED'
    );
  }
  
  return context;
}

/**
 * Authorization Error class
 */
export class AuthorizationError extends Error {
  code: string;
  permission?: Permission;
  
  constructor(message: string, code: string, permission?: Permission) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.permission = permission;
  }
}
