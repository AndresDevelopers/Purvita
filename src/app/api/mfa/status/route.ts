import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMfaService } from '@/modules/mfa';

/**
 * GET /api/mfa/status
 * 
 * Get the current MFA status for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const mfaService = createMfaService(supabase);
    const status = await mfaService.getMfaStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('[MFA Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
