import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMfaService } from '@/modules/mfa';
import { z } from 'zod';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';

const VerifySchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

/**
 * POST /api/mfa/verify
 * 
 * Verify MFA enrollment with a TOTP code.
 * This completes the enrollment process and activates MFA.
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
    const validatedData = VerifySchema.parse(body);

    const mfaService = createMfaService(supabase);
    const result = await mfaService.verifyEnrollment(validatedData.factorId, validatedData.code);

    if (!result.success) {
      // Log failed verification attempt
      await SecurityAuditLogger.log(
        SecurityEventType.MFA_VERIFICATION_FAILED,
        SecurityEventSeverity.WARNING,
        'MFA enrollment verification failed',
        {
          userId: user.id,
          factorId: validatedData.factorId,
        },
        false
      );

      return NextResponse.json(
        { error: result.error || 'Verification failed' },
        { status: 400 }
      );
    }

    // Log successful MFA enrollment
    await SecurityAuditLogger.log(
      SecurityEventType.MFA_ENABLED,
      SecurityEventSeverity.INFO,
      'MFA successfully enabled',
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
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    console.error('[MFA Verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
