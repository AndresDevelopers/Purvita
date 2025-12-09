import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMfaService } from '@/modules/mfa';
import { z } from 'zod';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';

const UnenrollSchema = z.object({
  factorId: z.string().uuid(),
});

/**
 * POST /api/mfa/unenroll
 * 
 * Disable MFA for the authenticated user.
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
    const validatedData = UnenrollSchema.parse(body);

    const mfaService = createMfaService(supabase);
    const result = await mfaService.unenrollMfa(validatedData.factorId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to disable MFA' },
        { status: 400 }
      );
    }

    // Log MFA disabled event
    await SecurityAuditLogger.log(
      SecurityEventType.MFA_DISABLED,
      SecurityEventSeverity.WARNING,
      'MFA disabled by user',
      {
        userId: user.id,
        factorId: validatedData.factorId,
      },
      false
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    console.error('[MFA Unenroll] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
