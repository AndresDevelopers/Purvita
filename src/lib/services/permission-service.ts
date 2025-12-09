/**
 * Permission Service
 *
 * Handles permission checking for the custom roles system.
 * This service validates user permissions based on their assigned role.
 */

import { createClient } from '@/lib/supabase/server';
import type { Permission } from '@/lib/models/role';

export interface UserPermissions {
  userId: string;
  role: 'admin' | 'member';
  roleId: string | null;
  roleName: string | null;
  permissions: Permission[];
  isAdmin: boolean;
}

/**
 * Get user permissions from their assigned role
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions | null> {
  try {
    const supabase = await createClient();

    // First, get the profile with role_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // If user has no role_id assigned, they have no permissions
    if (!profile.role_id) {
      return {
        userId,
        role: 'member',
        roleId: null,
        roleName: null,
        permissions: [],
        isAdmin: false,
      };
    }

    // Now fetch the role data separately
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id, name, permissions')
      .eq('id', profile.role_id)
      .single();

    if (roleError || !roleData) {
      return {
        userId,
        role: 'member',
        roleId: profile.role_id,
        roleName: null,
        permissions: [],
        isAdmin: false,
      };
    }

    // Extract permissions from the role (RBAC system)
    const permissions = roleData.permissions || [];

    // User is admin if they have the access_admin_panel permission
    const isAdmin = permissions.includes('access_admin_panel');

    return {
      userId,
      role: isAdmin ? 'admin' : 'member',
      roleId: profile.role_id,
      roleName: roleData.name,
      permissions,
      isAdmin,
    };
  } catch (error) {
    console.error('[getUserPermissions] Error:', error);
    return null;
  }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  
  if (!userPermissions || !userPermissions.isAdmin) {
    return false;
  }

  return userPermissions.permissions.includes(permission);
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  
  if (!userPermissions || !userPermissions.isAdmin) {
    return false;
  }

  return permissions.some(permission => userPermissions.permissions.includes(permission));
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  
  if (!userPermissions || !userPermissions.isAdmin) {
    return false;
  }

  return permissions.every(permission => userPermissions.permissions.includes(permission));
}

/**
 * Require user to have a specific permission (throws error if not)
 */
export async function requirePermission(userId: string, permission: Permission): Promise<void> {
  const hasAccess = await hasPermission(userId, permission);
  
  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission} required`);
  }
}

/**
 * Require user to have ANY of the specified permissions (throws error if not)
 */
export async function requireAnyPermission(userId: string, permissions: Permission[]): Promise<void> {
  const hasAccess = await hasAnyPermission(userId, permissions);
  
  if (!hasAccess) {
    throw new Error(`Permission denied: one of [${permissions.join(', ')}] required`);
  }
}

/**
 * Require user to have ALL of the specified permissions (throws error if not)
 */
export async function requireAllPermissions(userId: string, permissions: Permission[]): Promise<void> {
  const hasAccess = await hasAllPermissions(userId, permissions);
  
  if (!hasAccess) {
    throw new Error(`Permission denied: all of [${permissions.join(', ')}] required`);
  }
}

