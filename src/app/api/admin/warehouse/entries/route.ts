import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  WarehouseTrackingCreateInputSchema,
  WarehouseTrackingResponseSchema,
} from '@/modules/orders/warehouse/domain/models/warehouse-tracking';
import {
  adminRowSchema,
  createAdminClientOrThrow,
  ensureAdmin,
  mapRowToEvent,
  querySchema,
} from './admin-warehouse-utils';
import { OrderNotificationService } from '@/modules/orders/services/order-notification-service';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

export async function GET(request: NextRequest) {
  try {
    const params = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    await ensureAdmin();

    let adminClient: SupabaseClient;
    try {
      adminClient = createAdminClientOrThrow();
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error('[warehouse-tracking] unable to create admin client', error);
      return NextResponse.json({ error: 'Unable to load warehouse entries.' }, { status: 500 });
    }

    const limit = params.limit ?? 25;
    let query = adminClient
      .from('warehouse_tracking_admin_view')
      .select('*')
      .order('event_time', { ascending: false })
      .limit(limit + 1);

    if (params.search && params.search.trim().length > 0) {
      const normalized = `%${params.search.trim()}%`;
      query = query.or(
        [
          `order_id.ilike.${normalized}`,
          `order_code.ilike.${normalized}`,
          `tracking_code.ilike.${normalized}`,
          `location.ilike.${normalized}`,
          `note.ilike.${normalized}`,
          `customer_email.ilike.${normalized}`,
        ].join(','),
      );
    }

    if (params.cursor) {
      query = query.lt('event_time', params.cursor);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[warehouse-tracking] failed to fetch entries', error);
      return NextResponse.json({ error: 'Unable to load warehouse entries.' }, { status: 500 });
    }

    const rows = (data ?? []).map((row) => adminRowSchema.parse(row));

    let nextCursor: string | null = null;
    let entries = rows;

    if (rows.length > limit) {
      const last = rows.pop();
      if (last) {
        nextCursor = last.event_time;
      }
      entries = rows;
    }

    const payload = {
      entries: entries.map(mapRowToEvent),
      nextCursor,
    };

    return NextResponse.json(WarehouseTrackingResponseSchema.parse(payload));
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('[warehouse-tracking] unexpected GET error', error);
    return NextResponse.json({ error: 'Unexpected error loading entries.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate CSRF token
  const { requireCsrfToken } = await import('@/lib/security/csrf-protection');
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const { session } = await ensureAdmin();
    const body = await request.json();
    const payload = WarehouseTrackingCreateInputSchema.parse(body);

    let adminClient: SupabaseClient;
    try {
      adminClient = createAdminClientOrThrow();
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error('[warehouse-tracking] unable to create admin client for POST', error);
      return NextResponse.json({ error: 'Unable to create tracking entry.' }, { status: 500 });
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, user_id, status')
      .eq('id', payload.orderId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }

      console.error('[warehouse-tracking] failed to load order', orderError);
      return NextResponse.json({ error: 'Unable to load order.' }, { status: 500 });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('fulfillment_company')
      .eq('id', order.user_id)
      .maybeSingle();

    const defaultCompany = (profile?.fulfillment_company as string | null) ?? null;

    const estimatedDelivery = payload.estimatedDelivery
      ? new Date(payload.estimatedDelivery)
      : null;
    const eventTime = payload.eventTime ? new Date(payload.eventTime) : new Date();

    const trackingCode = payload.trackingCode?.trim();

    const insertPayload: Record<string, unknown> = {
      order_id: payload.orderId,
      status: payload.status,
      responsible_company: payload.responsibleCompany ?? defaultCompany,
      location: payload.location ?? null,
      note: payload.note ?? null,
      estimated_delivery: estimatedDelivery ? estimatedDelivery.toISOString().slice(0, 10) : null,
      event_time: eventTime.toISOString(),
      created_by: session.user.id,
    };

    if (typeof trackingCode === 'string' && trackingCode.length > 0) {
      insertPayload.tracking_code = trackingCode;
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('warehouse_tracking_entries')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) {
      console.error('[warehouse-tracking] failed to insert entry', insertError);
      return NextResponse.json({ error: 'Unable to create tracking entry.' }, { status: 500 });
    }

    const { data: viewRow, error: viewError } = await adminClient
      .from('warehouse_tracking_admin_view')
      .select('*')
      .eq('id', inserted.id)
      .single();

    if (viewError) {
      console.error('[warehouse-tracking] failed to load entry view', viewError);
      return NextResponse.json({ error: 'Unable to load created entry.' }, { status: 500 });
    }

    const event = mapRowToEvent(adminRowSchema.parse(viewRow));

    // Send email notification based on status
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
            deliveryDate: eventTime.toISOString(),
          });
          console.log('[warehouse-tracking] Delivery email sent to:', viewRow.customer_email);
        } else if (payload.status === 'canceled') {
          await notificationService.sendCancellationNotificationEmail({
            ...commonParams,
            reason: payload.note || undefined,
          });
          console.log('[warehouse-tracking] Cancellation email sent to:', viewRow.customer_email);
        } else if (['in_transit', 'packed', 'delayed'].includes(payload.status)) {
          await notificationService.sendTrackingUpdateEmail({
            ...commonParams,
            status: payload.status,
            location: payload.location || undefined,
            estimatedDelivery: estimatedDelivery?.toISOString() || undefined,
          });
          console.log('[warehouse-tracking] Tracking update email sent to:', viewRow.customer_email);
        }
      }
    } catch (emailError) {
      console.error('[warehouse-tracking] Failed to send notification email:', emailError);
      // Don't fail the tracking creation if email fails
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Created warehouse tracking entry',
      {
        ...extractRequestMetadata(request),
        action: 'create_warehouse_tracking',
        resourceType: 'warehouse_tracking',
        orderId: payload.orderId,
        status: payload.status,
        trackingCode: payload.trackingCode,
        entryId: inserted.id,
      },
      true
    );

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('[warehouse-tracking] unexpected POST error', error);
    return NextResponse.json({ error: 'Unexpected error creating entry.' }, { status: 500 });
  }
}
