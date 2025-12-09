import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * POST /api/admin/payments/sync-config
 * Synchronizes payment configuration with user payout preferences
 * This endpoint is called after admin updates payment schedule settings
 * Requires: manage_payments permission
 */
export const POST = withAdminPermission('manage_payments', async (req) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }


  try {
    const supabase = await createClient();

    // Get current payment schedule settings
    const { data: schedule, error: scheduleError } = await supabase
      .from('payment_schedule_settings')
      .select('default_amount_cents, payment_mode')
      .limit(1)
      .maybeSingle();

    if (scheduleError) {
      console.error('[sync-config] Failed to fetch schedule:', scheduleError);
      return NextResponse.json({ error: 'Failed to fetch payment schedule' }, { status: 500 });
    }

    if (!schedule) {
      return NextResponse.json({ error: 'Payment schedule not configured' }, { status: 404 });
    }

    // Update all user payout preferences to meet the new minimum
    const { data: updatedPreferences, error: updateError } = await supabase
      .from('payout_preferences')
      .update({
        auto_payout_threshold_cents: schedule.default_amount_cents,
        updated_at: new Date().toISOString(),
      })
      .lt('auto_payout_threshold_cents', schedule.default_amount_cents)
      .select('user_id');

    if (updateError) {
      console.error('[sync-config] Failed to update preferences:', updateError);
      return NextResponse.json({ error: 'Failed to sync user preferences' }, { status: 500 });
    }

    const affectedUsers = updatedPreferences?.length ?? 0;

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Synchronized payment configuration',
      {
        ...extractRequestMetadata(req),
        action: 'sync_payment_config',
        resourceType: 'payment_config',
        affectedUsers: affectedUsers,
        minimumAmountCents: schedule.default_amount_cents,
        paymentMode: schedule.payment_mode,
      },
      true
    );

    return NextResponse.json(
      {
        success: true,
        message: `Successfully synchronized payment configuration`,
        affectedUsers,
        minimumAmountCents: schedule.default_amount_cents,
        paymentMode: schedule.payment_mode,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[sync-config] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
})

