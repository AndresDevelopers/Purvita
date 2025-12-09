import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';
import { getAdminClient } from '@/lib/supabase/admin';
import { SentryLogger } from '@/modules/observability/services/sentry-logger';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/admin/payment-requests/[id]/approve
 * Approve a payment request and credit user balance (admin)
 * Requires: manage_payments permission
 */
export const POST = withAdminPermission('manage_payments',
  async (req, context) => {
    // ✅ SECURITY: Validate CSRF token
    const csrfError = await requireCsrfToken(req);
    if (csrfError) return csrfError;

    try {
      const { id } = await (context?.params || Promise.resolve({ id: '' }));
      const supabase = getAdminClient();

      const body = await req.json();
      const { adminNotes } = body;

      const service = new PaymentWalletService(supabase);
      const request = await service.approvePaymentRequest(id, req.user.id, adminNotes);

      // ✅ SECURITY: Audit log for payment approval
      await SecurityAuditLogger.log(
        SecurityEventType.ADMIN_ACTION,
        SecurityEventSeverity.CRITICAL,
        'Approved payment request',
        {
          ...extractRequestMetadata(req),
          action: 'approve_payment_request',
          resourceType: 'payment_request',
          paymentRequestId: id,
          hasAdminNotes: !!adminNotes,
        },
        true
      );

      return NextResponse.json({
        success: true,
        message: 'Payment request approved and balance credited',
        request
      });
    } catch (error) {
      SentryLogger.captureException(error instanceof Error ? error : new Error(String(error)), {
        module: 'admin',
        operation: 'approve_payment_request',
        tags: { error_type: 'payment_error' },
      });
      const message = error instanceof Error ? error.message : 'Failed to approve payment request';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
