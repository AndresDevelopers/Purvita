import { NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryEventBus } from '@/modules/payments/history/domain/events/payment-history-event-bus';
import { PaymentHistoryService } from '@/modules/payments/history/services/payment-history-service';
import { PaymentScheduleUpdateInputSchema } from '@/modules/payments/history/domain/models/payment-schedule';
import SupabasePaymentHistoryRepository from '@/modules/payments/history/repositories/payment-history-supabase-repository';
import { AdminApiError, getAdminContext } from '../_lib/admin-context';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

export async function GET() {
  try {
    const { supabase, user } = await getAdminContext();
    const repository = new SupabasePaymentHistoryRepository(supabase, { currentUserId: user.id });
    const service = new PaymentHistoryService(repository, new PaymentHistoryEventBus());

    const schedule = await service.getSchedule();
    return NextResponse.json({ schedule });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load payment schedule configuration', error);
    return NextResponse.json({ error: 'Failed to load payment schedule configuration' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const { supabase, user } = await getAdminContext();
    const repository = new SupabasePaymentHistoryRepository(supabase, { currentUserId: user.id });
    const service = new PaymentHistoryService(repository, new PaymentHistoryEventBus());

    const body = await request.json();
    const payload = PaymentScheduleUpdateInputSchema.parse(body);
    const schedule = await service.updateSchedule(payload);

    return NextResponse.json({ schedule });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update payment schedule configuration', error);
    const message = error instanceof Error ? error.message : 'Failed to update payment schedule configuration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
