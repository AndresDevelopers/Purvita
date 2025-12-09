import { PaymentError } from '../utils/payment-errors';
import { PaymentProviderFactory } from '../factories/payment-provider-factory';
import type { PaymentProvider } from '../domain/models/payment-gateway';
import { SentryLogger } from '../../../modules/observability/services/sentry-logger';

export interface CartItem {
  productId: string;
  quantity: number;
  priceCents: number;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  isTest?: boolean;
  successUrl?: string;
  cancelUrl?: string;
  originUrl?: string; // URL to return to after payment completion
  metadata?: Record<string, unknown>;
  cartItems?: CartItem[];
}

export interface PaymentResponse {
  url?: string;
  approvalUrl?: string;
  orderId?: string;
  sessionId?: string;
  status: string;
}

export class PaymentService {
  static async createPayment(
    provider: PaymentProvider,
    request: PaymentRequest,
    customHeaders?: Record<string, string>
  ): Promise<PaymentResponse> {
    console.log(`[PaymentService] Creating payment for provider: ${provider}`, {
      amount: request.amount,
      currency: request.currency,
    });

    const config = PaymentProviderFactory.getConfig(provider);
    const payload = config.buildPayload(request);

    console.log(`[PaymentService] Payload for ${provider}:`, payload);
    console.log(`[PaymentService] Endpoint: ${config.endpoint}`);

    let response: Response;
    try {
      response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...customHeaders,
        },
        body: JSON.stringify(payload),
      });
      console.log(`[PaymentService] Response status: ${response.status}`);
    } catch (fetchError) {
      console.error(`[PaymentService] Network error:`, fetchError);

      const error = new PaymentError(
        `Network error: Unable to connect to payment service`,
        provider,
        'NETWORK_ERROR' as any,
        { provider, timestamp: new Date() },
        false,
        fetchError
      );

      SentryLogger.capturePaymentError(error, {
        operation: 'create_payment',
        provider: provider,
        amount: request.amount,
        extra: {
          request,
          fetchError: String(fetchError),
        },
      });

      throw error;
    }

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        console.error(`[PaymentService] Raw error response:`, responseText);
        
        if (responseText) {
          try {
            errorData = JSON.parse(responseText);
          } catch (_parseError) {
            errorData = { error: responseText, rawResponse: true };
          }
        }
      } catch (readError) {
        console.error(`[PaymentService] Failed to read error response:`, readError);
        errorData = { error: 'Failed to read error response', readError: String(readError) };
      }
      
      console.error(`[PaymentService] Payment failed:`, errorData);
      console.error(`[PaymentService] Request details:`, {
        provider,
        endpoint: config.endpoint,
        amount: request.amount,
        currency: request.currency,
      });

      const error = new PaymentError(
        errorData.error || `Failed to create ${provider} payment`,
        provider,
        errorData.code,
        errorData
      );

      // Log to Sentry
      SentryLogger.capturePaymentError(error, {
        operation: 'create_payment',
        provider: provider,
        amount: request.amount,
        extra: {
          request,
          errorData,
          responseStatus: response.status,
        },
      });

      throw error;
    }

    const responseData = await response.json();
    console.log(`[PaymentService] Payment response:`, responseData);

    return responseData;
  }

  static getPaymentUrl(provider: PaymentProvider, response: PaymentResponse): string | null {
    const config = PaymentProviderFactory.getConfig(provider);
    return config.extractUrl(response);
  }

  static getTestInfo(provider: PaymentProvider): string[] {
    const config = PaymentProviderFactory.getConfig(provider);
    return config.getTestInfo();
  }
}