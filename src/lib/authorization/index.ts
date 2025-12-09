/**
 * Authorization Module
 * 
 * Core authorization system for the application.
 * This module provides role-based access control (RBAC) that is
 * INDEPENDENT of any specific feature (like admin panel).
 * 
 * IMPORTANT: Roles and permissions are the STANDARD for access control.
 * They should be used throughout the entire application, not just admin.
 * 
 * Usage:
 * - Import permissions and roles from this module
 * - Use the authorization service to check permissions
 * - Use the withPermission middleware for API routes
 * - Use usePermissions hook in React components
 * 
 * @example
 * ```typescript
 * // In API routes
 * import { withPermission, withAnyPermission } from '@/lib/authorization';
 * 
 * export const GET = withPermission('manage_users', async (request) => {
 *   // User has 'manage_users' permission
 *   return NextResponse.json({ users });
 * });
 * 
 * // In server code
 * import { hasPermission, getAuthorizationContext } from '@/lib/authorization';
 * 
 * const canManage = await hasPermission(userId, 'manage_users');
 * const context = await getAuthorizationContext(userId);
 * 
 * // In React components
 * import { usePermissions, usePermissionGuard } from '@/lib/authorization';
 * 
 * function MyComponent() {
 *   const { hasPermission, isLoading } = usePermissions();
 *   if (!hasPermission('manage_users')) return <AccessDenied />;
 *   return <UserManagement />;
 * }
 * ```
 */

// ============================================
// Models - Permission and Role definitions
// ============================================
export {
  // Permission schema and type
  PermissionSchema,
  type Permission,
  ALL_PERMISSIONS,
  
  // Permission metadata
  PERMISSION_REGISTRY,
  PERMISSION_LABELS,
  PermissionCategory,
  type PermissionMetadata,
  
  // Permission utilities
  getPermissionLabel,
  getPermissionsByCategory,
} from './models/permission';

export {
  // Role schemas and types
  RoleSchema,
  CreateRoleSchema,
  UpdateRoleSchema,
  RoleWithCountSchema,
  type Role,
  type CreateRoleInput,
  type UpdateRoleInput,
  type RoleWithCount,
  type AuthorizationContext,
  
  // System roles
  SystemRoles,
  type SystemRole,
  isSystemRole,
} from './models/role';

// ============================================
// Services - Authorization logic
// ============================================
export {
  // Authorization checks
  getAuthorizationContext,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  
  // Requirement helpers (throw on failure)
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  
  // Error class
  AuthorizationError,
} from './services/authorization-service';

export {
  // Role CRUD operations
  getAllRoles,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  deleteRole,
  
  // User-role management
  assignRoleToUser,
  removeRoleFromUser,
  getUsersByRole,
} from './services/role-management-service';

// ============================================
// Middleware - API route protection
// ============================================
export {
  // Auth middleware
  withAuth,
  withPermission,
  withAnyPermission,
  withAllPermissions,
  
  // Types
  type AuthorizedRequest,
  type AuthorizedHandler,
  
  // Helpers
  checkPermission,
  ensurePermission,
} from './middleware/with-permission';

// ============================================
// Hooks - Client-side authorization
// ============================================
export {
  usePermissions,
  useHasPermission,
  usePermissionGuard,
  type UsePermissionsState,
  type UsePermissionsResult,
} from './hooks/use-permissions';
