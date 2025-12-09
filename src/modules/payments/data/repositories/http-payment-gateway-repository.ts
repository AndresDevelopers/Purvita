import type { PaymentGatewayRepository } from '../../domain/contracts/payment-gateway-repository';
import {
  PaymentGatewayPublicInfoSchema,
  PaymentGatewaySettingsSchema,
  PaymentGatewayUpdateInputSchema,
  type PaymentGatewayPublicInfo,
  type PaymentGatewaySettings,
  type PaymentGatewayUpdateInput,
} from '../../domain/models/payment-gateway';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

const ADMIN_ENDPOINT = '/api/admin/payments';
const PUBLIC_ENDPOINT = '/api/payments/providers';

const handleResponse = async <T>(response: Response, parser: (payload: unknown) => T): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  const json = await response.json();
  return parser(json);
};

export class HttpPaymentGatewayRepository implements PaymentGatewayRepository {
  constructor(private readonly fetcher: Fetcher = defaultFetcher) {}

  async listSettings(): Promise<PaymentGatewaySettings[]> {
    const response = await this.fetcher(ADMIN_ENDPOINT, { cache: 'no-store' });
    return handleResponse(response, (payload) => PaymentGatewaySettingsSchema.array().parse(payload));
  }

  async listActiveGateways(): Promise<PaymentGatewayPublicInfo[]> {
    const response = await this.fetcher(PUBLIC_ENDPOINT, { cache: 'no-store' });
    return handleResponse(response, (payload) => PaymentGatewayPublicInfoSchema.array().parse(payload));
  }

  async updateSettings(input: PaymentGatewayUpdateInput): Promise<PaymentGatewaySettings> {
    const payload = PaymentGatewayUpdateInputSchema.parse(input);
    // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
    const response = await adminApi.put(ADMIN_ENDPOINT, payload);

    return handleResponse(response, (payload) => PaymentGatewaySettingsSchema.parse(payload));
  }
}
