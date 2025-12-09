import {
  OrderFulfillmentRequestSchema,
  OrderFulfillmentSnapshotSchema,
  type OrderFulfillmentRequest,
  type OrderFulfillmentSnapshot,
} from '../domain/models/order-fulfillment';

export interface OrderFulfillmentRepository {
  fetchDailyOrders(input: OrderFulfillmentRequest): Promise<OrderFulfillmentSnapshot>;
}

const API_BASE_PATH = '/api/admin/orders/fulfillment';

const parseErrorResponse = async (response: Response): Promise<Error> => {
  try {
    const payload = await response.json();
    const message = typeof payload?.error === 'string' ? payload.error : response.statusText;
    return new Error(message || 'Unexpected server response');
  } catch (_error) {
    return new Error(response.statusText || 'Unexpected server response');
  }
};

class HttpOrderFulfillmentRepository implements OrderFulfillmentRepository {
  async fetchDailyOrders(input: OrderFulfillmentRequest): Promise<OrderFulfillmentSnapshot> {
    const params = OrderFulfillmentRequestSchema.parse(input);
    const url = new URL(
      API_BASE_PATH,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
    );
    url.searchParams.set('date', params.date);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const payload = await response.json();
    return OrderFulfillmentSnapshotSchema.parse(payload);
  }
}

class OrderFulfillmentRepositoryFactoryImpl {
  private instance: OrderFulfillmentRepository | null = null;

  create(): OrderFulfillmentRepository {
    if (!this.instance) {
      this.instance = new HttpOrderFulfillmentRepository();
    }

    return this.instance;
  }
}

export const OrderFulfillmentRepositoryFactory = new OrderFulfillmentRepositoryFactoryImpl();

export { HttpOrderFulfillmentRepository };
