import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient as createSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import {
  WarehouseTrackingEventSchema,
  WAREHOUSE_TRACKING_STATUSES,
} from '@/modules/orders/warehouse/domain/models/warehouse-tracking';

/**
 * Shared schema for the admin warehouse tracking view rows.
 * Exported so both the collection and item routes reuse the same validation logic.
 */
export const adminRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  order_code: z.string().nullable(),
  status: z.string(),
  responsible_company: z.string().nullable(),
  tracking_code: z.string().nullable(),
  location: z.string().nullable(),
  note: z.string().nullable(),
  estimated_delivery: z.string().nullable(),
  event_time: z.string(),
  created_at: z.string(),
  created_by: z.string().nullable(),
  order_status: z.string(),
  user_id: z.string(),
  customer_name: z.string().nullable(),
  customer_email: z.string().nullable(),
  fulfillment_company: z.string().nullable(),
});

export type AdminWarehouseRow = z.infer<typeof adminRowSchema>;

export const mapRowToEvent = (row: AdminWarehouseRow) =>
  WarehouseTrackingEventSchema.parse({
    id: row.id,
    orderId: row.order_id,
    orderCode: row.order_code ?? null,
    status: row.status,
    responsibleCompany: row.responsible_company ?? row.fulfillment_company ?? null,
    trackingCode: row.tracking_code,
    location: row.location,
    note: row.note,
    estimatedDelivery: row.estimated_delivery ? new Date(row.estimated_delivery).toISOString() : null,
    eventTime: new Date(row.event_time).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    orderStatus: row.order_status,
  });

export const querySchema = z.object({
  cursor: z.string().optional(),
  status: z.enum(WAREHOUSE_TRACKING_STATUSES).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

/**
 * Ensures user has admin access and required permissions using RBAC system
 * @returns Authenticated supabase client and session
 */
export const ensureAdmin = async () => {
  const supabase = await createSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Response('Unauthorized.', { status: 401 });
  }

  if (!session?.user?.id) {
    throw new Response('Unauthorized.', { status: 401 });
  }

  // Check permissions using RBAC system (no hardcoded role check)
  const { getUserPermissions } = await import('@/lib/services/permission-service');
  const userPermissions = await getUserPermissions(session.user.id);

  // Require both access_admin_panel and manage_products permissions
  const hasAdminAccess = userPermissions?.permissions.includes('access_admin_panel');
  const hasManageProducts = userPermissions?.permissions.includes('manage_products');

  if (!hasAdminAccess) {
    throw new Response('Forbidden: access_admin_panel permission required', { status: 403 });
  }

  if (!hasManageProducts) {
    throw new Response('Forbidden: manage_products permission required', { status: 403 });
  }

  return { supabase, session };
};

export const createAdminClientOrThrow = (): SupabaseClient => {
  try {
    return createAdminClient();
  } catch (error) {
    console.error('[warehouse-tracking] unable to create admin client', error);
    throw NextResponse.json({ error: 'Unable to access admin resources.' }, { status: 500 });
  }
};
