import type { SupabaseClient } from '@supabase/supabase-js';
import {
  WarehouseTrackingCreateInputSchema,
  WarehouseTrackingEventSchema,
  WarehouseTrackingResponseSchema,
  WarehouseTrackingStatusSchema,
  WarehouseTrackingUpdateInputSchema,
  type WarehouseTrackingCreateInput,
  type WarehouseTrackingEvent,
  type WarehouseTrackingResponse,
  type WarehouseTrackingUpdateInput,
} from '../domain/models/warehouse-tracking';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

export interface WarehouseTrackingAdminRepository {
  list(params?: {
    cursor?: string | null;
    status?: string | null;
    search?: string | null;
    limit?: number;
  }): Promise<WarehouseTrackingResponse>;
  create(input: WarehouseTrackingCreateInput): Promise<WarehouseTrackingEvent>;
  update(entryId: string, input: WarehouseTrackingUpdateInput): Promise<WarehouseTrackingEvent>;
}

const API_BASE = '/api/admin/warehouse/entries';

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('[WarehouseTrackingRepository] Failed to parse JSON', error, text);
    throw new Error('Invalid server response.');
  }
};

class HttpWarehouseTrackingAdminRepository implements WarehouseTrackingAdminRepository {
  async list(params?: {
    cursor?: string | null;
    status?: string | null;
    search?: string | null;
    limit?: number;
  }): Promise<WarehouseTrackingResponse> {
    const url = new URL(
      API_BASE,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
    );

    if (params?.cursor) {
      url.searchParams.set('cursor', params.cursor);
    }

    if (params?.status) {
      url.searchParams.set('status', params.status);
    }

    if (params?.search) {
      url.searchParams.set('search', params.search);
    }

    if (params?.limit) {
      url.searchParams.set('limit', String(params.limit));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (!response.ok) {
      const payload = await parseJson(response);
      const message = typeof payload.error === 'string' ? payload.error : response.statusText;
      throw new Error(message || 'Failed to load warehouse entries.');
    }

    const payload = await parseJson(response);
    return WarehouseTrackingResponseSchema.parse(payload);
  }

  async create(input: WarehouseTrackingCreateInput): Promise<WarehouseTrackingEvent> {
    const body = WarehouseTrackingCreateInputSchema.parse(input);

    // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
    const response = await adminApi.post(API_BASE, body);

    if (!response.ok) {
      const payload = await parseJson(response);
      const message = typeof payload.error === 'string' ? payload.error : response.statusText;
      throw new Error(message || 'Failed to create tracking entry.');
    }

    const payload = await parseJson(response);
    return WarehouseTrackingEventSchema.parse(payload);
  }

  async update(entryId: string, input: WarehouseTrackingUpdateInput): Promise<WarehouseTrackingEvent> {
    const body = WarehouseTrackingUpdateInputSchema.parse(input);

    // ✅ SECURITY: Use adminApi.patch() to automatically include CSRF token
    const response = await adminApi.patch(`${API_BASE}/${entryId}`, body);

    if (!response.ok) {
      const payload = await parseJson(response);
      const message = typeof payload.error === 'string' ? payload.error : response.statusText;
      throw new Error(message || 'Failed to update tracking entry.');
    }

    const payload = await parseJson(response);
    return WarehouseTrackingEventSchema.parse(payload);
  }
}

class WarehouseTrackingAdminRepositoryFactoryImpl {
  private instance: WarehouseTrackingAdminRepository | null = null;

  create(): WarehouseTrackingAdminRepository {
    if (!this.instance) {
      this.instance = new HttpWarehouseTrackingAdminRepository();
    }

    return this.instance;
  }
}

export const WarehouseTrackingAdminRepositoryFactory = new WarehouseTrackingAdminRepositoryFactoryImpl();

export class WarehouseTrackingSupabaseRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByOrderIds(orderIds: string[]): Promise<WarehouseTrackingEvent[]> {
    if (orderIds.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from('warehouse_tracking_entries')
      .select(
        `id,
         order_id,
         status,
         responsible_company,
         tracking_code,
         location,
         note,
         estimated_delivery,
         event_time,
         created_at,
         created_by`
      )
      .in('order_id', orderIds)
      .order('event_time', { ascending: false });

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];

    return rows.map((row) => {
      const parsedStatus = WarehouseTrackingStatusSchema.safeParse(row.status);

      if (!parsedStatus.success) {
        console.warn(
          '[WarehouseTrackingSupabaseRepository] Received entry with invalid status',
          row.status,
        );
      }

      return {
        id: String(row.id),
        orderId: String(row.order_id),
        orderCode: null,
        status: (parsedStatus.success ? parsedStatus.data : 'pending') as WarehouseTrackingEvent['status'],
        responsibleCompany: (row.responsible_company as string | null) ?? null,
        trackingCode: (row.tracking_code as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        estimatedDelivery: row.estimated_delivery ? new Date(row.estimated_delivery as string).toISOString() : null,
        eventTime: new Date(row.event_time as string).toISOString(),
        createdAt: new Date(row.created_at as string).toISOString(),
        customerName: null,
        customerEmail: null,
        orderStatus: '',
      };
    });
  }
}

export { HttpWarehouseTrackingAdminRepository };
