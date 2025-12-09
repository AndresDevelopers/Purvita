import { NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryEventBus } from '@/modules/payments/history/domain/events/payment-history-event-bus';
import { PaymentHistoryService } from '@/modules/payments/history/services/payment-history-service';
import { PaymentStatusSchema } from '@/modules/payments/history/domain/models/payment-history-entry';
import SupabasePaymentHistoryRepository from '@/modules/payments/history/repositories/payment-history-supabase-repository';
import { AdminApiError, getAdminContext } from '../_lib/admin-context';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const { id } = await context.params;
    const { supabase, user } = await getAdminContext();
    const repository = new SupabasePaymentHistoryRepository(supabase, { currentUserId: user.id });
    const service = new PaymentHistoryService(repository, new PaymentHistoryEventBus());

    const body = await request.json();
    const status = PaymentStatusSchema.parse(body?.status);
    const entry = await service.updateStatus(id, status);

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update payment history status', error);
    const message = error instanceof Error ? error.message : 'Failed to update payment history status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
