/**
 * GET /api/authorization/me
 * 
 * Get current user's authorization context.
 * This endpoint is used by the usePermissions hook.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthorizationContext } from '@/lib/authorization';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const context = await getAuthorizationContext(user.id);

    if (!context) {
      return NextResponse.json({
        userId: user.id,
        roleId: null,
        roleName: null,
        permissions: [],
      });
    }

    return NextResponse.json(context);
  } catch (error) {
    console.error('[GET /api/authorization/me] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
