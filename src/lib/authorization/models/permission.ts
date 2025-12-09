import { z } from 'zod';

/**
 * Permission Model
 * 
 * Core permission definitions for the authorization system.
 * Permissions are atomic access rights that can be assigned to roles.
 * 
 * IMPORTANT: This is a CORE system module, not an admin feature.
 * All parts of the application should use this for access control.
 */

/**
 * Permission Categories
 * Organize permissions by functional area
 */
export const PermissionCategory = {
  SYSTEM: 'system',
  USERS: 'users',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  CONTENT: 'content',
  REPORTS: 'reports',
  SECURITY: 'security',
} as const;

export type PermissionCategory = typeof PermissionCategory[keyof typeof PermissionCategory];

/**
 * Available permissions in the system
 * 
 * Naming convention: action_resource
 * - view_* : Read access
 * - manage_* : Full CRUD access
 * - access_* : Entry access to a section
 */
export const PermissionSchema = z.enum([
  // System permissions
  'access_admin_panel',  // Access to administrative interface
  'view_dashboard',      // View system dashboard
  'manage_settings',     // Modify system settings
  
  // User management
  'manage_users',        // Full user management
  'view_users',          // View user list and details
  
  // Product management
  'manage_products',     // Full product management
  'view_products',       // View product catalog
  
  // Order management
  'manage_orders',       // Full order management
  'view_orders',         // View orders
  
  // Payment management
  'manage_payments',     // Full payment management
  'view_payments',       // View payment records
  
  // Plan management
  'manage_plans',        // Manage subscription plans
  'view_plans',          // View plans
  
  // Content management
  'manage_content',      // Full content management
  'view_content',        // View content
  
  // Reports and analytics
  'view_reports',        // View reports and analytics
  'export_reports',      // Export report data
  
  // Security and audit
  'manage_security',     // Manage security settings
  'manage_roles',        // Manage roles and permissions
  'view_audit_logs',     // View audit logs
]);

export type Permission = z.infer<typeof PermissionSchema>;

/**
 * All available permissions as array
 */
export const ALL_PERMISSIONS: Permission[] = PermissionSchema.options;

/**
 * Permission metadata for UI display and categorization
 */
export interface PermissionMetadata {
  key: Permission;
  category: PermissionCategory;
  labels: {
    en: string;
    es: string;
  };
  description: {
    en: string;
    es: string;
  };
}

/**
 * Complete permission registry with metadata
 */
export const PERMISSION_REGISTRY: Record<Permission, PermissionMetadata> = {
  // System permissions
  access_admin_panel: {
    key: 'access_admin_panel',
    category: PermissionCategory.SYSTEM,
    labels: { en: 'Access Admin Panel', es: 'Acceder al Panel de Administración' },
    description: { en: 'Allows access to the administrative interface', es: 'Permite acceso a la interfaz administrativa' },
  },
  view_dashboard: {
    key: 'view_dashboard',
    category: PermissionCategory.SYSTEM,
    labels: { en: 'View Dashboard', es: 'Ver Panel' },
    description: { en: 'View the main dashboard with metrics', es: 'Ver el panel principal con métricas' },
  },
  manage_settings: {
    key: 'manage_settings',
    category: PermissionCategory.SYSTEM,
    labels: { en: 'Manage Settings', es: 'Gestionar Configuración' },
    description: { en: 'Modify system settings', es: 'Modificar configuración del sistema' },
  },
  
  // User permissions
  manage_users: {
    key: 'manage_users',
    category: PermissionCategory.USERS,
    labels: { en: 'Manage Users', es: 'Gestionar Usuarios' },
    description: { en: 'Create, edit, and delete users', es: 'Crear, editar y eliminar usuarios' },
  },
  view_users: {
    key: 'view_users',
    category: PermissionCategory.USERS,
    labels: { en: 'View Users', es: 'Ver Usuarios' },
    description: { en: 'View user list and details', es: 'Ver lista y detalles de usuarios' },
  },
  
  // Product permissions
  manage_products: {
    key: 'manage_products',
    category: PermissionCategory.PRODUCTS,
    labels: { en: 'Manage Products', es: 'Gestionar Productos' },
    description: { en: 'Create, edit, and delete products', es: 'Crear, editar y eliminar productos' },
  },
  view_products: {
    key: 'view_products',
    category: PermissionCategory.PRODUCTS,
    labels: { en: 'View Products', es: 'Ver Productos' },
    description: { en: 'View product catalog', es: 'Ver catálogo de productos' },
  },
  
  // Order permissions
  manage_orders: {
    key: 'manage_orders',
    category: PermissionCategory.ORDERS,
    labels: { en: 'Manage Orders', es: 'Gestionar Pedidos' },
    description: { en: 'Process and manage orders', es: 'Procesar y gestionar pedidos' },
  },
  view_orders: {
    key: 'view_orders',
    category: PermissionCategory.ORDERS,
    labels: { en: 'View Orders', es: 'Ver Pedidos' },
    description: { en: 'View order list and details', es: 'Ver lista y detalles de pedidos' },
  },
  
  // Payment permissions
  manage_payments: {
    key: 'manage_payments',
    category: PermissionCategory.PAYMENTS,
    labels: { en: 'Manage Payments', es: 'Gestionar Pagos' },
    description: { en: 'Process payments and refunds', es: 'Procesar pagos y reembolsos' },
  },
  view_payments: {
    key: 'view_payments',
    category: PermissionCategory.PAYMENTS,
    labels: { en: 'View Payments', es: 'Ver Pagos' },
    description: { en: 'View payment records', es: 'Ver registros de pagos' },
  },
  
  // Plan permissions
  manage_plans: {
    key: 'manage_plans',
    category: PermissionCategory.PRODUCTS,
    labels: { en: 'Manage Plans', es: 'Gestionar Planes' },
    description: { en: 'Create and modify subscription plans', es: 'Crear y modificar planes de suscripción' },
  },
  view_plans: {
    key: 'view_plans',
    category: PermissionCategory.PRODUCTS,
    labels: { en: 'View Plans', es: 'Ver Planes' },
    description: { en: 'View subscription plans', es: 'Ver planes de suscripción' },
  },
  
  // Content permissions
  manage_content: {
    key: 'manage_content',
    category: PermissionCategory.CONTENT,
    labels: { en: 'Manage Content', es: 'Gestionar Contenido' },
    description: { en: 'Edit site content and pages', es: 'Editar contenido y páginas del sitio' },
  },
  view_content: {
    key: 'view_content',
    category: PermissionCategory.CONTENT,
    labels: { en: 'View Content', es: 'Ver Contenido' },
    description: { en: 'View content entries', es: 'Ver entradas de contenido' },
  },
  
  // Report permissions
  view_reports: {
    key: 'view_reports',
    category: PermissionCategory.REPORTS,
    labels: { en: 'View Reports', es: 'Ver Reportes' },
    description: { en: 'View analytics and reports', es: 'Ver analíticas y reportes' },
  },
  export_reports: {
    key: 'export_reports',
    category: PermissionCategory.REPORTS,
    labels: { en: 'Export Reports', es: 'Exportar Reportes' },
    description: { en: 'Export report data', es: 'Exportar datos de reportes' },
  },
  
  // Security permissions
  manage_security: {
    key: 'manage_security',
    category: PermissionCategory.SECURITY,
    labels: { en: 'Manage Security', es: 'Gestionar Seguridad' },
    description: { en: 'Configure security settings', es: 'Configurar ajustes de seguridad' },
  },
  manage_roles: {
    key: 'manage_roles',
    category: PermissionCategory.SECURITY,
    labels: { en: 'Manage Roles', es: 'Gestionar Roles' },
    description: { en: 'Create and modify roles', es: 'Crear y modificar roles' },
  },
  view_audit_logs: {
    key: 'view_audit_logs',
    category: PermissionCategory.SECURITY,
    labels: { en: 'View Audit Logs', es: 'Ver Registros de Auditoría' },
    description: { en: 'View system audit logs', es: 'Ver registros de auditoría del sistema' },
  },
};

/**
 * Get permissions by category
 */
export function getPermissionsByCategory(category: PermissionCategory): PermissionMetadata[] {
  return Object.values(PERMISSION_REGISTRY).filter(p => p.category === category);
}

/**
 * Get permission label in specified language
 */
export function getPermissionLabel(permission: Permission, lang: 'en' | 'es' = 'es'): string {
  return PERMISSION_REGISTRY[permission]?.labels[lang] || permission;
}

/**
 * Legacy compatibility - PERMISSION_LABELS
 * @deprecated Use PERMISSION_REGISTRY instead
 */
export const PERMISSION_LABELS: Record<Permission, { en: string; es: string }> = 
  Object.fromEntries(
    Object.entries(PERMISSION_REGISTRY).map(([key, meta]) => [key, meta.labels])
  ) as Record<Permission, { en: string; es: string }>;
