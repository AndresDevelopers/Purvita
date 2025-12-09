import { z } from 'zod';

/**
 * Role and Permission Models
 * 
 * Defines the structure for roles and permissions in the system.
 * Roles are used to control access to different parts of the admin panel.
 */

// Available permissions in the system
export const PermissionSchema = z.enum([
  'access_admin_panel', // Required to access the admin panel
  'view_dashboard',
  'manage_users',
  'manage_products',
  'manage_orders',
  'manage_payments',
  'manage_plans',
  'manage_content',
  'manage_settings',
  'view_reports',
  'manage_security',
  'manage_roles',
  'view_audit_logs', // View audit logs and system activity
]);

export type Permission = z.infer<typeof PermissionSchema>;

// Role schema for database
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

// Schema for creating a new role
export const CreateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name is too long'),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  permissions: z.array(PermissionSchema).min(1, 'At least one permission is required'),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

// Schema for updating a role
export const UpdateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  permissions: z.array(PermissionSchema).min(1, 'At least one permission is required').optional(),
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

// Role with user count (for display in tables)
export const RoleWithCountSchema = RoleSchema.extend({
  user_count: z.number().int().min(0).default(0),
});

export type RoleWithCount = z.infer<typeof RoleWithCountSchema>;

// Permission labels for UI display
export const PERMISSION_LABELS: Record<Permission, { en: string; es: string }> = {
  access_admin_panel: {
    en: 'Access Admin Panel',
    es: 'Acceder al Panel de Administración',
  },
  view_dashboard: {
    en: 'View Dashboard',
    es: 'Ver Panel',
  },
  manage_users: {
    en: 'Manage Users',
    es: 'Gestionar Usuarios',
  },
  manage_products: {
    en: 'Manage Products',
    es: 'Gestionar Productos',
  },
  manage_orders: {
    en: 'Manage Orders',
    es: 'Gestionar Pedidos',
  },
  manage_payments: {
    en: 'Manage Payments',
    es: 'Gestionar Pagos',
  },
  manage_plans: {
    en: 'Manage Plans',
    es: 'Gestionar Planes',
  },
  manage_content: {
    en: 'Manage Content',
    es: 'Gestionar Contenido',
  },
  manage_settings: {
    en: 'Manage Settings',
    es: 'Gestionar Configuración',
  },
  view_reports: {
    en: 'View Reports',
    es: 'Ver Reportes',
  },
  manage_security: {
    en: 'Manage Security',
    es: 'Gestionar Seguridad',
  },
  manage_roles: {
    en: 'Manage Roles',
    es: 'Gestionar Roles',
  },
  view_audit_logs: {
    en: 'View Audit Logs',
    es: 'Ver Registros de Auditoría',
  },
};

