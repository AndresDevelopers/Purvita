import type {
  PaymentGatewayPublicInfo,
  PaymentGatewaySettings,
  PaymentGatewayUpdateInput,
} from '../models/payment-gateway';

export interface PaymentGatewayRepository {
  listSettings(): Promise<PaymentGatewaySettings[]>;
  updateSettings(input: PaymentGatewayUpdateInput): Promise<PaymentGatewaySettings>;
  listActiveGateways(): Promise<PaymentGatewayPublicInfo[]>;
}
