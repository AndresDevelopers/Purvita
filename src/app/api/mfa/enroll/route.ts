import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMfaService } from '@/modules/mfa';
import { z } from 'zod';

const EnrollSchema = z.object({
  friendlyName: z.string().max(100).optional(),
});

/**
 * POST /api/mfa/enroll
 * 
 * Start MFA enrollment for the authenticated user.
 * Returns QR code and secret for authenticator app setup.
 */
export async function POST(req: NextRequest) {
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

    // Parse and validate body
    const body = await req.json();
    const validatedData = EnrollSchema.parse(body);

    const mfaService = createMfaService(supabase);
    const result = await mfaService.enrollMfa(validatedData.friendlyName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Enrollment failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      enrollment: result.enrollment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[MFA Enroll] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
