'use client';

/**
 * Client-side Permissions Hook
 * 
 * Provides authorization context for React components.
 * This hook fetches and caches the user's permissions.
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { permissions, hasPermission, isLoading } = usePermissions();
 *   
 *   if (isLoading) return <Spinner />;
 *   
 *   if (!hasPermission('manage_users')) {
 *     return <AccessDenied />;
 *   }
 *   
 *   return <UserManagement />;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Permission } from '../models/permission';
import type { AuthorizationContext } from '../models/role';

export interface UsePermissionsState {
  isLoading: boolean;
  isAuthenticated: boolean;
  permissions: Permission[];
  roleId: string | null;
  roleName: string | null;
  error: Error | null;
}

export interface UsePermissionsResult extends UsePermissionsState {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to get user's permissions
 */
export function usePermissions(): UsePermissionsResult {
  const [state, setState] = useState<UsePermissionsState>({
    isLoading: true,
    isAuthenticated: false,
    permissions: [],
    roleId: null,
    roleName: null,
    error: null,
  });

  const fetchPermissions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/authorization/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            permissions: [],
            roleId: null,
            roleName: null,
            error: null,
          });
          return;
        }
        throw new Error('Failed to fetch permissions');
      }

      const data: AuthorizationContext = await response.json();

      setState({
        isLoading: false,
        isAuthenticated: true,
        permissions: data.permissions,
        roleId: data.roleId,
        roleName: data.roleName,
        error: null,
      });
    } catch (error) {
      console.error('[usePermissions] Error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return state.permissions.includes(permission);
    },
    [state.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.some(p => state.permissions.includes(p));
    },
    [state.permissions]
  );

  const hasAllPermissions = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.every(p => state.permissions.includes(p));
    },
    [state.permissions]
  );

  return useMemo(
    () => ({
      ...state,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refetch: fetchPermissions,
    }),
    [state, hasPermission, hasAnyPermission, hasAllPermissions, fetchPermissions]
  );
}

/**
 * Hook to check a specific permission
 * Useful for conditional rendering
 */
export function useHasPermission(permission: Permission): {
  hasPermission: boolean;
  isLoading: boolean;
} {
  const { permissions, isLoading } = usePermissions();

  return useMemo(
    () => ({
      hasPermission: permissions.includes(permission),
      isLoading,
    }),
    [permissions, permission, isLoading]
  );
}

/**
 * Hook to guard a component based on permission
 * Returns redirect path if user doesn't have permission
 */
export function usePermissionGuard(
  requiredPermission: Permission,
  redirectPath: string = '/'
): {
  isLoading: boolean;
  hasAccess: boolean;
  redirectTo: string | null;
} {
  const { permissions, isLoading, isAuthenticated } = usePermissions();

  return useMemo(() => {
    if (isLoading) {
      return { isLoading: true, hasAccess: false, redirectTo: null };
    }

    if (!isAuthenticated) {
      return { isLoading: false, hasAccess: false, redirectTo: '/login' };
    }

    const hasAccess = permissions.includes(requiredPermission);

    return {
      isLoading: false,
      hasAccess,
      redirectTo: hasAccess ? null : redirectPath,
    };
  }, [permissions, isLoading, isAuthenticated, requiredPermission, redirectPath]);
}
