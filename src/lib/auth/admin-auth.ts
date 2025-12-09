import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserPermissions } from '@/lib/services/permission-service'

export async function verifyAdminAuth() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Use RBAC permission system instead of hardcoded role check
  const userPermissions = await getUserPermissions(user.id)

  if (!userPermissions || !userPermissions.permissions.includes('access_admin_panel')) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Forbidden - Missing access_admin_panel permission' }, { status: 403 })
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, name, role_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }
  }

  return { authorized: true, user, profile, permissions: userPermissions }
}

export async function ensureAdmin() {
  const result = await verifyAdminAuth();
  
  if (!result.authorized) {
    return {
      success: false as const,
      error: result.response,
      user: null
    };
  }

  return {
    success: true as const,
    user: result.user,
    profile: result.profile
  };
}
