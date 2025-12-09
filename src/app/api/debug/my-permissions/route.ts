import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { getUserPermissions } from '@/lib/services/permission-service';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/debug/my-permissions
 * Debug endpoint to show current user's role and permissions
 * Helps diagnose permission issues
 */
export const GET = withAuth(async (request) => {
  try {
    const supabase = await createClient();

    // Get raw profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role_id,
        created_at,
        updated_at
      `)
      .eq('id', request.user.id)
      .single();

    // Get role data if role_id exists
    let roleData = null;
    if (profile?.role_id) {
      const { data: role } = await supabase
        .from('roles')
        .select('*')
        .eq('id', profile.role_id)
        .single();
      roleData = role;
    }

    // Get permissions through service
    const userPermissions = await getUserPermissions(request.user.id);

    // Check for access_admin_panel specifically
    const hasAdminAccess = userPermissions?.permissions.includes('access_admin_panel') || false;

    return NextResponse.json({
      debug: {
        timestamp: new Date().toISOString(),
        userId: request.user.id,
      },
      profile: {
        email: profile?.email,
        name: profile?.name,
        roleId: profile?.role_id,
        hasRoleId: !!profile?.role_id,
      },
      rbacRole: roleData ? {
        id: roleData.id,
        name: roleData.name,
        isSystemRole: roleData.is_system_role,
        permissions: roleData.permissions,
        permissionCount: roleData.permissions?.length || 0,
      } : null,
      permissions: {
        hasAdminAccess,
        permissions: userPermissions?.permissions || [],
        isAdmin: userPermissions?.isAdmin || false,
      },
      diagnosis: {
        hasRoleIdAssigned: !!profile?.role_id,
        hasPermissions: (userPermissions?.permissions.length || 0) > 0,
        canAccessAdmin: hasAdminAccess,
        issues: [
          !profile?.role_id && 'ERROR: User has no role_id assigned - run URGENT_FIX_APPLY_THIS.sql',
          !roleData && profile?.role_id && 'ERROR: role_id points to non-existent role',
          !userPermissions && 'ERROR: Could not fetch user permissions',
        ].filter(Boolean),
      },
      sqlFix: !profile?.role_id ? {
        message: 'User needs role_id assigned. Run this SQL in Supabase:',
        sql: `UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE name = 'Member' AND is_system_role = true LIMIT 1) WHERE id = '${request.user.id}';`,
        note: 'This assigns Member role by default. If you need Super Admin, change "Member" to "Super Admin" in the SQL above.'
      } : null,
    });
  } catch (error) {
    console.error('[debug/my-permissions] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch debug information',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
