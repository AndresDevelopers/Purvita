import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { WarehouseTrackingUpdateInputSchema } from '@/modules/orders/warehouse/domain/models/warehouse-tracking';
import {
  adminRowSchema,
  createAdminClientOrThrow,
  ensureAdmin,
  mapRowToEvent,
} from '../admin-warehouse-utils';
import { OrderNotificationService } from '@/modules/orders/services/order-notification-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const paramsSchema = z.object({
  entryId: z.string().uuid(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entryId: string }> }
) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const { session } = await ensureAdmin();
    const params = await context.params;
    const { entryId } = paramsSchema.parse(params);
    const body = await request.json();
    const payload = WarehouseTrackingUpdateInputSchema.parse(body);

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No updates provided.' }, { status: 400 });
    }

    let adminClient: SupabaseClient;
    try {
      adminClient = createAdminClientOrThrow();
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error('[warehouse-tracking] unable to create admin client for PATCH', error);
      return NextResponse.json({ error: 'Unable to update tracking entry.' }, { status: 500 });
    }

    const updates: Record<string, unknown> = {};

    if (payload.status !== undefined) {
      updates.status = payload.status;
    }

    if (payload.responsibleCompany !== undefined) {
      updates.responsible_company = payload.responsibleCompany;
    }

    if (payload.trackingCode !== undefined) {
      updates.tracking_code = payload.trackingCode;
    }

    if (payload.location !== undefined) {
      updates.location = payload.location;
    }

    if (payload.note !== undefined) {
      updates.note = payload.note;
    }

    if (payload.estimatedDelivery !== undefined) {
      updates.estimated_delivery = payload.estimatedDelivery
        ? new Date(payload.estimatedDelivery).toISOString().slice(0, 10)
        : null;
    }

    if (payload.eventTime !== undefined) {
      updates.event_time = payload.eventTime ? new Date(payload.eventTime).toISOString() : new Date().toISOString();
    }

    updates.created_by = session.user.id;

    const { data: updated, error: updateError } = await adminClient
      .from('warehouse_tracking_entries')
      .update(updates)
      .eq('id', entryId)
      .select('*')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
      }

      console.error('[warehouse-tracking] failed to update entry', updateError);
      return NextResponse.json({ error: 'Unable to update tracking entry.' }, { status: 500 });
    }

    const { data: viewRow, error: viewError } = await adminClient
      .from('warehouse_tracking_admin_view')
      .select('*')
      .eq('id', updated.id)
      .single();

    if (viewError) {
      console.error('[warehouse-tracking] failed to load updated entry', viewError);
      return NextResponse.json({ error: 'Unable to load updated entry.' }, { status: 500 });
    }

    const event = mapRowToEvent(adminRowSchema.parse(viewRow));

    // Send email notification if status changed to important states
    if (payload.status !== undefined) {
      try {
        const notificationService = new OrderNotificationService(adminClient);

        if (viewRow.customer_email) {
          const commonParams = {
            orderId: viewRow.order_id,
            orderCode: viewRow.order_code || undefined,
            userEmail: viewRow.customer_email,
            userName: viewRow.customer_name || 'Customer',
            trackingCode: viewRow.tracking_code || undefined,
            responsibleCompany: viewRow.responsible_company || undefined,
          };

          if (payload.status === 'delivered') {
            await notificationService.sendDeliveryConfirmationEmail({
              ...commonParams,
              deliveryDate: updated.event_time,
            });
            console.log('[warehouse-tracking] Delivery email sent to:', viewRow.customer_email);
          } else if (payload.status === 'canceled') {
            await notificationService.sendCancellationNotificationEmail({
              ...commonParams,
              reason: payload.note || viewRow.note || undefined,
            });
            console.log('[warehouse-tracking] Cancellation email sent to:', viewRow.customer_email);
          } else if (['in_transit', 'packed', 'delayed'].includes(payload.status)) {
            await notificationService.sendTrackingUpdateEmail({
              ...commonParams,
              status: payload.status,
              location: payload.location || viewRow.location || undefined,
              estimatedDelivery: viewRow.estimated_delivery || undefined,
            });
            console.log('[warehouse-tracking] Tracking update email sent to:', viewRow.customer_email);
          }
        }
      } catch (emailError) {
        console.error('[warehouse-tracking] Failed to send notification email:', emailError);
        // Don't fail the tracking update if email fails
      }
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated warehouse tracking entry',
      {
        ...extractRequestMetadata(request),
        action: 'update_warehouse_tracking',
        resourceType: 'warehouse_tracking',
        entryId: entryId,
        changes: payload,
      },
      true
    );

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('[warehouse-tracking] unexpected PATCH error', error);
    return NextResponse.json({ error: 'Unexpected error updating entry.' }, { status: 500 });
  }
}
