import { getAppUrl } from '@/lib/env';
import type { PaymentProvider } from '../domain/models/payment-gateway';

export interface PaymentReturnUrlOptions {
  provider: PaymentProvider;
  originUrl?: string;
  paymentId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentReturnUrls {
  successUrl: string;
  cancelUrl: string;
}

export class PaymentReturnUrlService {
  private static readonly RESULT_PATH = '/payment/result';
  
  /**
   * Validates that a URL is from the same domain for security
   */
  private static isValidOriginUrl(url: string): boolean {
    try {
      const originUrl = new URL(url);
      const appUrl = new URL(getAppUrl());
      
      // Must be same protocol and host
      return originUrl.protocol === appUrl.protocol && 
             originUrl.host === appUrl.host;
    } catch {
      return false;
    }
  }

  /**
   * Safely decodes a URL from query parameters
   * Note: URLSearchParams (searchParams.get()) already decodes the URL automatically
   */
  static decodeOriginUrl(encodedUrl: string): string | null {
    try {
      console.log('[PaymentReturnUrlService] Decoding URL:', encodedUrl);
      console.log('[PaymentReturnUrlService] App URL:', getAppUrl());
      
      const isValid = this.isValidOriginUrl(encodedUrl);
      console.log('[PaymentReturnUrlService] Is valid:', isValid);
      
      return isValid ? encodedUrl : null;
    } catch (error) {
      console.error('[PaymentReturnUrlService] Decode error:', error);
      return null;
    }
  }

  /**
   * Builds query parameters for return URLs
   */
  private static buildReturnParams(
    provider: PaymentProvider,
    status: 'success' | 'cancel',
    options: PaymentReturnUrlOptions
  ): URLSearchParams {
    const params = new URLSearchParams({
      provider,
      status,
    });

    if (options.originUrl && this.isValidOriginUrl(options.originUrl)) {
      // URLSearchParams.set() automatically encodes the value, so we don't need to encode manually
      params.set('origin_url', options.originUrl);
    }

    if (options.paymentId) {
      params.set('payment_id', options.paymentId);
    }

    // Note: We don't add session_id or token here because:
    // - Stripe will automatically append session_id={CHECKOUT_SESSION_ID} to the success_url
    // - PayPal will automatically append token and PayerID to the return_url
    // Adding them here would cause them to be URL-encoded and not replaced by the payment gateway

    return params;
  }

  /**
   * Generates return URLs for payment providers
   */
  static generateReturnUrls(options: PaymentReturnUrlOptions): PaymentReturnUrls {
    const baseUrl = getAppUrl();

    const successParams = this.buildReturnParams(options.provider, 'success', options);
    const cancelParams = this.buildReturnParams(options.provider, 'cancel', options);

    let successUrl = `${baseUrl}${this.RESULT_PATH}?${successParams.toString()}`;
    let cancelUrl = `${baseUrl}${this.RESULT_PATH}?${cancelParams.toString()}`;

    // For Stripe, append the session_id placeholder that Stripe will replace
    // We do this AFTER URLSearchParams to avoid URL encoding the curly braces
    if (options.provider === 'stripe') {
      successUrl += '&session_id={CHECKOUT_SESSION_ID}';
    }

    return { successUrl, cancelUrl };
  }

  /**
   * Extracts the origin URL from current window location
   * This should be called on the client side before initiating payment
   */
  static getCurrentOriginUrl(): string | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }

    try {
      return window.location.href;
    } catch {
      return undefined;
    }
  }

  /**
   * Builds a return URL with payment status for direct redirects
   */
  static buildReturnUrlWithStatus(
    originUrl: string,
    status: 'success' | 'error' | 'cancelled',
    provider: PaymentProvider,
    additionalParams?: Record<string, string>
  ): string {
    if (!this.isValidOriginUrl(originUrl)) {
      // Fallback to homepage if origin URL is invalid
      return `${getAppUrl()}/?payment_status=${status}&provider=${provider}`;
    }

    try {
      const url = new URL(originUrl);
      url.searchParams.set('payment_status', status);
      url.searchParams.set('provider', provider);
      
      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      return url.toString();
    } catch {
      return `${getAppUrl()}/?payment_status=${status}&provider=${provider}`;
    }
  }
}
