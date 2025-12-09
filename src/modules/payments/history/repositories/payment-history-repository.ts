import {
  ManualPaymentInputSchema,
  PaymentHistoryEntrySchema,
  PaymentHistoryFilterSchema,
  PaymentStatusSchema,
  type ManualPaymentInput,
  type PaymentHistoryEntry,
  type PaymentHistoryFilter,
  type PaymentStatus,
} from '../domain/models/payment-history-entry';
import {
  PaymentScheduleConfigSchema,
  PaymentScheduleUpdateInputSchema,
  type PaymentScheduleConfig,
  type PaymentScheduleUpdateInput,
} from '../domain/models/payment-schedule';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

export interface PaymentHistoryRepository {
  getHistory(filter?: PaymentHistoryFilter): Promise<PaymentHistoryEntry[]>;
  addManualPayment(input: ManualPaymentInput): Promise<PaymentHistoryEntry>;
  updateStatus(id: string, status: PaymentStatus): Promise<PaymentHistoryEntry>;
  getSchedule(): Promise<PaymentScheduleConfig>;
  updateSchedule(input: PaymentScheduleUpdateInput): Promise<PaymentScheduleConfig>;
}

const API_BASE_PATH = '/api/admin/payments/history';

const parseErrorResponse = async (response: Response): Promise<Error> => {
  try {
    const payload = await response.json();
    const message = typeof payload?.error === 'string' ? payload.error : response.statusText;
    return new Error(message || 'Unexpected server response');
  } catch (_error) {
    return new Error(response.statusText || 'Unexpected server response');
  }
};

const ensureSuccess = async <T>(response: Response, schema: (payload: unknown) => T): Promise<T> => {
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const data = await response.json();
  return schema(data);
};

const mapHistoryResponse = (payload: any): PaymentHistoryEntry[] => {
  const parsed = Array.isArray(payload?.entries) ? payload.entries : payload;
  return PaymentHistoryEntrySchema.array().parse(parsed);
};

const mapSingleEntryResponse = (payload: any): PaymentHistoryEntry =>
  PaymentHistoryEntrySchema.parse(payload?.entry ?? payload);

const mapScheduleResponse = (payload: any): PaymentScheduleConfig =>
  PaymentScheduleConfigSchema.parse(payload?.schedule ?? payload);

class HttpPaymentHistoryRepository implements PaymentHistoryRepository {
  async getHistory(filter?: PaymentHistoryFilter): Promise<PaymentHistoryEntry[]> {
    const safeFilter = filter ? PaymentHistoryFilterSchema.parse(filter) : undefined;
    const url = new URL(API_BASE_PATH, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);

    if (safeFilter?.status) {
      url.searchParams.set('status', safeFilter.status);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    });

    return ensureSuccess(response, mapHistoryResponse);
  }

  async addManualPayment(input: ManualPaymentInput): Promise<PaymentHistoryEntry> {
    const payload = ManualPaymentInputSchema.parse(input);
    // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
    const response = await adminApi.post(API_BASE_PATH, payload);

    return ensureSuccess(response, mapSingleEntryResponse);
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<PaymentHistoryEntry> {
    const payload = PaymentStatusSchema.parse(status);
    // ✅ SECURITY: Use adminApi.patch() to automatically include CSRF token
    const response = await adminApi.patch(`${API_BASE_PATH}/${id}`, { status: payload });

    return ensureSuccess(response, mapSingleEntryResponse);
  }

  async getSchedule(): Promise<PaymentScheduleConfig> {
    const response = await fetch(`${API_BASE_PATH}/schedule`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    });

    return ensureSuccess(response, mapScheduleResponse);
  }

  async updateSchedule(input: PaymentScheduleUpdateInput): Promise<PaymentScheduleConfig> {
    const payload = PaymentScheduleUpdateInputSchema.parse(input);
    // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
    const response = await adminApi.put(`${API_BASE_PATH}/schedule`, payload);

    return ensureSuccess(response, mapScheduleResponse);
  }
}

class PaymentHistoryRepositoryFactoryImpl {
  private instance: PaymentHistoryRepository | null = null;

  create(): PaymentHistoryRepository {
    if (!this.instance) {
      this.instance = new HttpPaymentHistoryRepository();
    }

    return this.instance;
  }
}

export const PaymentHistoryRepositoryFactory = new PaymentHistoryRepositoryFactoryImpl();

export { HttpPaymentHistoryRepository };
