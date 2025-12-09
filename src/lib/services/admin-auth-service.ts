import { createClient } from '@/lib/supabase/server';
import { getUserPermissions, type UserPermissions } from './permission-service';
import type { Permission } from '@/lib/models/role';

export interface AdminUser {
  id: string;
  roleName: string;
  permissions: UserPermissions | null;
}

export class AdminAuthService {
  /**
   * Verify that user has admin access to the admin panel.
   * User must have the `access_admin_panel` permission assigned through their role.
   */
  static async verifyAdminAccess(): Promise<AdminUser> {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id, roles(name, is_system_role)')
      .eq('id', user.id)
      .single();

    const roles = profile?.roles as { name: string; is_system_role: boolean }[] | { name: string; is_system_role: boolean } | null;
    const role = Array.isArray(roles) ? roles[0] : roles;

    if (!role) {
      throw new Error('Admin access required');
    }

    // Get user permissions from their assigned role
    const permissions = await getUserPermissions(user.id);

    // User must have access_admin_panel permission to access admin panel
    if (!permissions || !permissions.permissions.includes('access_admin_panel')) {
      throw new Error('Admin access required');
    }

    return {
      id: user.id,
      roleName: role.name,
      permissions,
    };
  }

  /**
   * Verify that user has admin role AND specific permission
   */
  static async verifyAdminPermission(permission: Permission): Promise<AdminUser> {
    const adminUser = await this.verifyAdminAccess();

    if (!adminUser.permissions) {
      throw new Error('No permissions assigned');
    }

    if (!adminUser.permissions.permissions.includes(permission)) {
      throw new Error(`Permission denied: ${permission} required`);
    }

    return adminUser;
  }

  /**
   * Verify that user has admin role AND any of the specified permissions
   */
  static async verifyAdminAnyPermission(permissions: Permission[]): Promise<AdminUser> {
    const adminUser = await this.verifyAdminAccess();

    if (!adminUser.permissions) {
      throw new Error('No permissions assigned');
    }

    const hasAny = permissions.some(p => adminUser.permissions!.permissions.includes(p));

    if (!hasAny) {
      throw new Error(`Permission denied: one of [${permissions.join(', ')}] required`);
    }

    return adminUser;
  }

  /**
   * Verify that user has admin role AND all of the specified permissions
   */
  static async verifyAdminAllPermissions(permissions: Permission[]): Promise<AdminUser> {
    const adminUser = await this.verifyAdminAccess();

    if (!adminUser.permissions) {
      throw new Error('No permissions assigned');
    }

    const hasAll = permissions.every(p => adminUser.permissions!.permissions.includes(p));

    if (!hasAll) {
      throw new Error(`Permission denied: all of [${permissions.join(', ')}] required`);
    }

    return adminUser;
  }
}