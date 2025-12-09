import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * PATCH /api/admin/users/[id]/phase
 * Update user phase
 * Requires: manage_users permission
 */
export const PATCH = withAdminPermission('manage_users', async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }


  try {
    const { id: userId } = await params;
    const adminClient = await createAdminClient();

    // Parse request body
    const body = await req.json();
    const { phase } = body;

    if (typeof phase !== 'number' || phase < 0 || phase > 3) {
      return NextResponse.json(
        { error: 'Invalid phase: must be a number between 0 and 3' },
        { status: 400 }
      );
    }

    // Call the admin function to set user phase
    const { data, error } = await adminClient.rpc('admin_set_user_phase', {
      p_user_id: userId,
      p_new_phase: phase,
      p_admin_id: req.user.id,
    });

    if (error) {
      console.error('Error setting user phase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; phase?: number; message?: string };

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update phase' }, { status: 400 });
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated user phase',
      {
        ...extractRequestMetadata(req),
        action: 'update_user_phase',
        resourceType: 'user_phase',
        userId: userId,
        newPhase: phase,
        previousPhase: result.phase,
      },
      true
    );

    return NextResponse.json({
      success: true,
      phase: result.phase,
      message: result.message,
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/users/[id]/phase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

/**
 * GET /api/admin/users/[id]/phase
 * Get current phase information for a user
 * Requires: manage_users permission
 */
export const GET = withAdminPermission('manage_users', async (
  _req,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: userId } = await params;
    const adminClient = await createAdminClient();

    // Get user phase information
    const { data: phaseData, error: phaseError } = await adminClient
      .from('phases')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (phaseError) {
      if (phaseError.code === 'PGRST116') {
        return NextResponse.json({ phase: null, message: 'User has no phase record' });
      }
      console.error('Error fetching user phase:', phaseError);
      return NextResponse.json({ error: phaseError.message }, { status: 500 });
    }

    return NextResponse.json({
      phase: phaseData.phase,
      highest_phase_achieved: phaseData.highest_phase_achieved,
      manual_phase_override: phaseData.manual_phase_override,
      ecommerce_commission: phaseData.ecommerce_commission,
      phase1_granted: phaseData.phase1_granted,
      phase2_granted: phaseData.phase2_granted,
      phase3_granted: phaseData.phase3_granted,
      phase2_achieved_at: phaseData.phase2_achieved_at,
      created_at: phaseData.created_at,
      updated_at: phaseData.updated_at,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users/[id]/phase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})
