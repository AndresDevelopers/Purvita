import { PAYMENT_CONSTANTS } from '../../constants/payment-constants';
import type { PayPalCredentials, TestPaymentRequest, TestPaymentResult } from '../../types/payment-types';
import { getAppUrl } from '@/lib/env';
import { PaymentReturnUrlService } from '../payment-return-url-service';
import { retry } from '@/lib/utils/retry';
import { circuitBreakerRegistry } from '@/lib/utils/circuit-breaker';

export class PayPalService {
  private static getAppUrl(): string {
    return getAppUrl();
  }

  private static getBaseUrl(clientId: string): string {
    return clientId.includes('sandbox') 
      ? PAYMENT_CONSTANTS.URLS.PAYPAL.SANDBOX
      : PAYMENT_CONSTANTS.URLS.PAYPAL.LIVE;
  }

  /**
   * Get circuit breaker for PayPal API
   */
  private static getCircuitBreaker() {
    return circuitBreakerRegistry.get('paypal-api', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minuto
    });
  }

  private static async getAccessToken(credentials: PayPalCredentials): Promise<string> {
    const { client_id, client_secret } = credentials;
    const baseUrl = this.getBaseUrl(client_id);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CONSTANTS.TIMEOUTS.API_REQUEST);

    try {
      const circuitBreaker = this.getCircuitBreaker();

      // Ejecutar con circuit breaker y retry logic
      const data = await circuitBreaker.execute(async () => {
        return await retry(
          async () => {
            const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'grant_type=client_credentials',
              signal: controller.signal,
            });

            if (!response.ok) {
              const error = new Error(`PayPal auth error: ${response.status} ${response.statusText}`);
              (error as any).status = (response as any).status;
              (error as any).response = response;
              throw error;
            }

            return await response.json();
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            onRetry: (error, attempt, delay) => {
              console.warn(`[PayPal] Auth retry attempt ${attempt} after ${delay}ms due to:`, error.message);
            },
          }
        );
      });

      return data.access_token;
    } catch (error) {
      console.error('[PayPal] Authentication failed:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async createTestPayment(
    credentials: PayPalCredentials,
    request: TestPaymentRequest,
    originUrl?: string
  ): Promise<TestPaymentResult> {
    const accessToken = await this.getAccessToken(credentials);
    const baseUrl = this.getBaseUrl(credentials.client_id);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CONSTANTS.TIMEOUTS.API_REQUEST);

    // Generate return URLs using the PaymentReturnUrlService
    let successUrl: string;
    let cancelUrl: string;

    if (originUrl) {
      const returnUrls = PaymentReturnUrlService.generateReturnUrls({
        provider: 'paypal',
        originUrl,
        metadata: { test: 'true' },
      });
      successUrl = returnUrls.successUrl;
      cancelUrl = returnUrls.cancelUrl;
    } else {
      // Fallback to admin URLs for backward compatibility
      successUrl = `${this.getAppUrl()}/admin/payments/result?provider=paypal&status=success`;
      cancelUrl = `${this.getAppUrl()}/admin/payments/result?provider=paypal&status=cancel`;
    }

    try {
      const circuitBreaker = this.getCircuitBreaker();

      // Ejecutar con circuit breaker y retry logic
      const orderData = await circuitBreaker.execute(async () => {
        return await retry(
          async () => {
            const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                  amount: {
                    currency_code: request.currency,
                    value: request.amount.toFixed(2),
                  },
                  description: request.description,
                }],
                application_context: {
                  return_url: successUrl,
                  cancel_url: cancelUrl,
                  brand_name: 'PūrVita Network Test',
                  user_action: 'PAY_NOW', // Ensures immediate payment
                },
              }),
              signal: controller.signal,
            });

            if (!response.ok) {
              const error = new Error(`PayPal API error: ${response.status} ${response.statusText}`);
              (error as any).status = (response as any).status;
              (error as any).response = response;
              throw error;
            }

            return await response.json();
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            onRetry: (error, attempt, delay) => {
              console.warn(`[PayPal] Order creation retry attempt ${attempt} after ${delay}ms due to:`, error.message);
            },
          }
        );
      });

      const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

      if (!approvalUrl) {
        throw new Error('PayPal approval URL not found');
      }

      return {
        success: true,
        paymentUrl: approvalUrl,
        orderId: orderData.id,
        testId: `paypal-test-${Date.now()}`,
        provider: 'paypal',
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        timestamp: new Date().toISOString(),
        environment: baseUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE',
      };
    } catch (error) {
      console.error('[PayPal] Order creation failed:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}