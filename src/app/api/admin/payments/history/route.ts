import { NextRequest, NextResponse } from 'next/server';
import { PaymentHistoryEventBus } from '@/modules/payments/history/domain/events/payment-history-event-bus';
import { PaymentHistoryService } from '@/modules/payments/history/services/payment-history-service';
import {
  ManualPaymentInputSchema,
  PaymentHistoryFilterSchema,
} from '@/modules/payments/history/domain/models/payment-history-entry';
import SupabasePaymentHistoryRepository from '@/modules/payments/history/repositories/payment-history-supabase-repository';
import { AdminApiError, getAdminContext } from './_lib/admin-context';
import { ManualPaymentProcessor } from '@/modules/payments/history/services/manual-payment-processor';
import type { PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';
import { PaymentNotificationService } from '@/modules/payments/services/payment-notification-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAdminContext();
    const repository = new SupabasePaymentHistoryRepository(supabase, { currentUserId: user.id });
    const service = new PaymentHistoryService(repository, new PaymentHistoryEventBus());

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const filter = status ? PaymentHistoryFilterSchema.parse({ status }) : undefined;

    const entries = await service.loadHistory(filter);
    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof AdminApiError) {
      console.error('[Payment History API] Admin error:', error.message, 'Status:', error.status);
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[Payment History API] Failed to load payment history entries:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to load payment history entries';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const payload = ManualPaymentInputSchema.parse(body);

    // Check if method is a payment provider (stripe, paypal, wallet)
    const isPaymentProvider = ['stripe', 'paypal', 'wallet'].includes(payload.method);

    let transactionId: string | undefined;
    let _paymentError: string | undefined;

    // Process payment if using a payment provider
    if (isPaymentProvider) {
      const processor = new ManualPaymentProcessor(supabase);
      const result = await processor.processPayment({
        userId: payload.userId,
        amountCents: payload.amountCents,
        currency: payload.currency,
        provider: payload.method as PaymentProvider,
        description: payload.notes || `Manual payout to ${payload.userName}`,
        adminId: user.id,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Payment processing failed' },
          { status: 400 }
        );
      }

      transactionId = result.transactionId;
    }

    // Add notes about transaction if processed
    const finalNotes = transactionId
      ? `${payload.notes || ''}\nTransaction ID: ${transactionId}`.trim()
      : payload.notes;

    // Register the payment in history
    const entry = await service.addManualPayment({
      ...payload,
      notes: finalNotes,
    });

    // Send payment confirmation email if payment was processed
    if (isPaymentProvider) {
      try {
        const notificationService = new PaymentNotificationService(supabase);
        await notificationService.sendPaymentConfirmation({
          userEmail: payload.userEmail,
          userName: payload.userName,
          amountCents: payload.amountCents,
          currency: payload.currency,
          paidAt: entry.paidAt || new Date().toISOString(),
          method: payload.method,
          transactionId,
          locale: 'en', // TODO: Get user's preferred locale
        });
      } catch (emailError) {
        console.error('[Payment History API] Failed to send payment confirmation email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(
      {
        entry,
        processed: isPaymentProvider,
        transactionId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create manual payment entry', error);
    const message = error instanceof Error ? error.message : 'Failed to create manual payment entry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
