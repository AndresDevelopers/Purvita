import { z } from 'zod';
import { PermissionSchema, type Permission } from './permission';

/**
 * Role Model
 * 
 * Core role definitions for the authorization system.
 * Roles group permissions together for easier management.
 * 
 * IMPORTANT: This is a CORE system module, not an admin feature.
 */

/**
 * Role schema for database
 */
export const RoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(PermissionSchema),
  is_system_role: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Role = z.infer<typeof RoleSchema>;

/**
 * Schema for creating a new role
 */
export const CreateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name is too long'),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  permissions: z.array(PermissionSchema).min(1, 'At least one permission is required'),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

/**
 * Schema for updating a role
 */
export const UpdateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  permissions: z.array(PermissionSchema).min(1, 'At least one permission is required').optional(),
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

/**
 * Role with user count (for display in tables)
 */
export const RoleWithCountSchema = RoleSchema.extend({
  user_count: z.number().int().min(0).default(0),
});

export type RoleWithCount = z.infer<typeof RoleWithCountSchema>;

/**
 * User's authorization context
 * Contains the user's role and effective permissions
 */
export interface AuthorizationContext {
  userId: string;
  roleId: string | null;
  roleName: string | null;
  permissions: Permission[];
}

/**
 * Predefined system roles
 * These are created by default and cannot be deleted
 */
export const SystemRoles = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MEMBER: 'Member',
} as const;

export type SystemRole = typeof SystemRoles[keyof typeof SystemRoles];

/**
 * Check if a role is a system role
 */
export function isSystemRole(roleName: string): boolean {
  return Object.values(SystemRoles).includes(roleName as SystemRole);
}
