/**
 * Role Management Service
 * 
 * CRUD operations for roles and permissions.
 * This service is part of the CORE authorization system.
 * 
 * NOTE: This service uses the service role client for administrative operations.
 * Access control should be handled at the API/route level using withPermission middleware.
 */

import { getServiceRoleClient } from '@/lib/supabase';
import type { Role, CreateRoleInput, UpdateRoleInput, RoleWithCount } from '../models/role';

/**
 * Get admin client with error handling
 */
function getAdminClient() {
  const client = getServiceRoleClient();
  if (!client) {
    throw new Error('Service role client is not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
  return client;
}

/**
 * Get all roles with user count
 */
export async function getAllRoles(): Promise<RoleWithCount[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('roles')
    .select(`
      *,
      user_count:profiles(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching roles:', error);
    throw new Error('Failed to fetch roles');
  }

  // Transform the data to match RoleWithCount schema
  return (data || []).map((role: any) => ({
    ...role,
    user_count: role.user_count?.[0]?.count || 0,
  }));
}

/**
 * Get a single role by ID
 */
export async function getRoleById(id: string): Promise<Role | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Role not found
    }
    console.error('Error fetching role:', error);
    throw new Error('Failed to fetch role');
  }

  return data;
}

/**
 * Get a role by name
 */
export async function getRoleByName(name: string): Promise<Role | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching role by name:', error);
    throw new Error('Failed to fetch role');
  }

  return data;
}

/**
 * Create a new role
 */
export async function createRole(input: CreateRoleInput): Promise<Role> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('roles')
    .insert({
      name: input.name,
      description: input.description || null,
      permissions: input.permissions,
      is_system_role: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating role:', error);
    if (error.code === '23505') {
      throw new Error('A role with this name already exists');
    }
    throw new Error('Failed to create role');
  }

  return data;
}

/**
 * Update an existing role
 */
export async function updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
  const supabase = getAdminClient();

  // Check if role is a system role
  const existingRole = await getRoleById(id);
  if (!existingRole) {
    throw new Error('Role not found');
  }

  if (existingRole.is_system_role) {
    throw new Error('Cannot modify system roles');
  }

  const updateData: Partial<Role> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.permissions !== undefined) updateData.permissions = input.permissions;

  const { data, error } = await supabase
    .from('roles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating role:', error);
    if (error.code === '23505') {
      throw new Error('A role with this name already exists');
    }
    throw new Error('Failed to update role');
  }

  return data;
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<void> {
  const supabase = getAdminClient();

  // Check if role is a system role
  const existingRole = await getRoleById(id);
  if (!existingRole) {
    throw new Error('Role not found');
  }

  if (existingRole.is_system_role) {
    throw new Error('Cannot delete system roles');
  }

  // Check if role has users assigned
  const { count, error: countError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role_id', id);

  if (countError) {
    console.error('Error checking role usage:', countError);
    throw new Error('Failed to check role usage');
  }

  if (count && count > 0) {
    throw new Error('Cannot delete role with assigned users');
  }

  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting role:', error);
    throw new Error('Failed to delete role');
  }
}

/**
 * Assign role to user
 */
export async function assignRoleToUser(userId: string, roleId: string): Promise<void> {
  const supabase = getAdminClient();

  // Verify role exists
  const role = await getRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role_id: roleId })
    .eq('id', userId);

  if (error) {
    console.error('Error assigning role:', error);
    throw new Error('Failed to assign role');
  }
}

/**
 * Remove role from user
 */
export async function removeRoleFromUser(userId: string): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('profiles')
    .update({ role_id: null })
    .eq('id', userId);

  if (error) {
    console.error('Error removing role:', error);
    throw new Error('Failed to remove role');
  }
}

/**
 * Get users with a specific role
 */
export async function getUsersByRole(roleId: string): Promise<{ id: string; email: string; name: string | null }[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name')
    .eq('role_id', roleId);

  if (error) {
    console.error('Error fetching users by role:', error);
    throw new Error('Failed to fetch users');
  }

  return data || [];
}
