import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * POST /api/admin/payment-requests/[id]/reject
 * Reject a payment request (admin)
 * Requires: manage_payments permission
 */
export const POST = withAdminPermission('manage_payments', async (
  req,
  context: { params: Promise<{ id: string }> }
) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }


  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const body = await req.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const service = new PaymentWalletService(supabase);
    const request = await service.rejectPaymentRequest(id, req.user.id, reason);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Rejected payment request',
      {
        ...extractRequestMetadata(req),
        action: 'reject_payment_request',
        resourceType: 'payment_request',
        paymentRequestId: id,
        reason: reason,
      },
      true
    );

    return NextResponse.json({
      success: true,
      message: 'Payment request rejected',
      request
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to reject payment request:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to reject payment request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
})
