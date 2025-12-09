import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export class AdminApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export interface AdminContext {
  supabase: SupabaseClient;
  user: { id: string };
}

/**
 * Gets admin context with RBAC permission check
 * Verifies user has access_admin_panel permission
 */
export const getAdminContext = async (): Promise<AdminContext> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new AdminApiError(authError.message, 500);
  }

  if (!user) {
    throw new AdminApiError('Unauthorized', 401);
  }

  // Check admin access using RBAC permission system
  const { getUserPermissions } = await import('@/lib/services/permission-service');
  const userPermissions = await getUserPermissions(user.id);

  const hasAdminAccess = userPermissions?.permissions.includes('access_admin_panel');
  const hasManagePayments = userPermissions?.permissions.includes('manage_payments');

  if (!hasAdminAccess || !hasManagePayments) {
    throw new AdminApiError(
      'Forbidden: access_admin_panel and manage_payments permissions required',
      403,
    );
  }

  return { supabase, user: { id: user.id } };
};
