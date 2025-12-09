import { PAYMENT_CONSTANTS } from '../constants/payment-constants';
import type { PayPalCredentials, StripeCredentials, ValidationResult } from '../types/payment-types';

export class PaymentValidators {
  static async validatePayPal(credentials: PayPalCredentials): Promise<ValidationResult> {
    const { client_id, client_secret } = credentials;
    
    if (!client_id || !client_secret) {
      throw new Error('PayPal credentials missing');
    }

    const baseUrl = client_id.includes('sandbox') 
      ? PAYMENT_CONSTANTS.URLS.PAYPAL.SANDBOX
      : PAYMENT_CONSTANTS.URLS.PAYPAL.LIVE;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CONSTANTS.TIMEOUTS.API_REQUEST);

    try {
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
        throw new Error('PayPal credentials invalid');
      }

      return {
        isValid: true,
        environment: baseUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE'
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async validateStripe(credentials: StripeCredentials): Promise<ValidationResult> {
    const { secret_key } = credentials;
    
    if (!secret_key || !secret_key.startsWith('sk_')) {
      throw new Error('Stripe secret key invalid');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CONSTANTS.TIMEOUTS.API_REQUEST);

    try {
      const response = await fetch(`${PAYMENT_CONSTANTS.URLS.STRIPE.API}/v1/account`, {
        headers: {
          'Authorization': `Bearer ${secret_key}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Stripe credentials invalid');
      }

      return {
        isValid: true,
        environment: secret_key.includes('test') ? 'TEST' : 'LIVE'
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}