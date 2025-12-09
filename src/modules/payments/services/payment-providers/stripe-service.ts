import { PAYMENT_CONSTANTS } from '../../constants/payment-constants';
import type { StripeCredentials, TestPaymentRequest, TestPaymentResult } from '../../types/payment-types';
import { getAppUrl } from '@/lib/env';
import { PaymentReturnUrlService } from '../payment-return-url-service';
import { retry } from '@/lib/utils/retry';
import { circuitBreakerRegistry } from '@/lib/utils/circuit-breaker';

export class StripeService {
  private static getAppUrl(): string {
    return getAppUrl();
  }

  /**
   * Get circuit breaker for Stripe API
   */
  private static getCircuitBreaker() {
    return circuitBreakerRegistry.get('stripe-api', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minuto
    });
  }

  static async createTestPayment(
    credentials: StripeCredentials,
    request: TestPaymentRequest,
    originUrl?: string
  ): Promise<TestPaymentResult> {
    const { secret_key } = credentials;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CONSTANTS.TIMEOUTS.API_REQUEST);

    // Generate return URLs using the PaymentReturnUrlService
    let successUrl: string;
    let cancelUrl: string;

    if (originUrl) {
      const returnUrls = PaymentReturnUrlService.generateReturnUrls({
        provider: 'stripe',
        originUrl,
        metadata: { test: 'true' },
      });
      successUrl = returnUrls.successUrl;
      cancelUrl = returnUrls.cancelUrl;
    } else {
      // Fallback to admin URLs for backward compatibility
      successUrl = `${this.getAppUrl()}/admin/payments/result?provider=stripe&status=success`;
      cancelUrl = `${this.getAppUrl()}/admin/payments/result?provider=stripe&status=cancel`;
    }

    try {
      const circuitBreaker = this.getCircuitBreaker();

      // Ejecutar con circuit breaker y retry logic
      const sessionData = await circuitBreaker.execute(async () => {
        return await retry(
          async () => {
            const response = await fetch(`${PAYMENT_CONSTANTS.URLS.STRIPE.API}/v1/checkout/sessions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${secret_key}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                'payment_method_types[0]': 'card',
                'line_items[0][price_data][currency]': request.currency.toLowerCase(),
                'line_items[0][price_data][product_data][name]': request.description,
                'line_items[0][price_data][unit_amount]': (request.amount * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS).toString(),
                'line_items[0][quantity]': '1',
                'mode': 'payment',
                'success_url': successUrl,
                'cancel_url': cancelUrl,
                'metadata[test]': 'true',
              }),
              signal: controller.signal,
            });

            if (!response.ok) {
              const error = new Error(`Stripe API error: ${response.status} ${response.statusText}`) as Error & { status?: number; response?: Response };
              error.status = response.status;
              error.response = response;
              throw error;
            }

            return await response.json();
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            onRetry: (error: unknown, attempt, delay) => {
              const message = error instanceof Error ? error.message : 'Unknown error';
              console.warn(`[Stripe] Retry attempt ${attempt} after ${delay}ms due to:`, message);
            },
          }
        );
      });

      return {
        success: true,
        paymentUrl: sessionData.url,
        sessionId: sessionData.id,
        testId: `stripe-test-${Date.now()}`,
        provider: 'stripe',
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        timestamp: new Date().toISOString(),
        environment: secret_key.includes('test') ? 'TEST' : 'LIVE',
      };
    } catch (error) {
      console.error('[Stripe] Payment creation failed:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}