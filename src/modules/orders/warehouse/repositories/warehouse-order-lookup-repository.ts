import {
  WarehouseOrderLookupResponseSchema,
  type WarehouseOrderSummary,
} from '../domain/order-lookup';

export interface WarehouseOrderLookupRepository {
  search(term: string): Promise<WarehouseOrderSummary[]>;
}

const API_BASE = '/api/admin/orders/search';

const parseJson = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('[WarehouseOrderLookupRepository] Failed to parse JSON', error, text);
    throw new Error('Invalid server response.');
  }
};

class HttpWarehouseOrderLookupRepository implements WarehouseOrderLookupRepository {
  async search(term: string): Promise<WarehouseOrderSummary[]> {
    const trimmed = term.trim();

    if (trimmed.length === 0) {
      return [];
    }

    const url = new URL(
      API_BASE,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
    );
    url.searchParams.set('term', trimmed);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (!response.ok) {
      const payload = await parseJson(response);
      const message = typeof payload.error === 'string' ? payload.error : response.statusText;
      throw new Error(message || 'Failed to search orders.');
    }

    const payload = await parseJson(response);
    const result = WarehouseOrderLookupResponseSchema.parse(payload);
    return result.orders;
  }
}

class WarehouseOrderLookupRepositoryFactoryImpl {
  private instance: WarehouseOrderLookupRepository | null = null;

  create(): WarehouseOrderLookupRepository {
    if (!this.instance) {
      this.instance = new HttpWarehouseOrderLookupRepository();
    }

    return this.instance;
  }
}

export const WarehouseOrderLookupRepositoryFactory = new WarehouseOrderLookupRepositoryFactoryImpl();

export { HttpWarehouseOrderLookupRepository };
