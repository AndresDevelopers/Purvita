import type { SupabaseClient } from '@supabase/supabase-js';

interface PayPalCredentials {
  client_id: string;
  client_secret: string;
}

interface BillingAgreement {
  id: string;
  userId: string;
  paypalBillingAgreementId: string;
  status: 'active' | 'cancelled' | 'suspended';
  createdAt: string;
}

/**
 * Service for managing PayPal Billing Agreements
 * 
 * PayPal Billing Agreements allow recurring payments without user interaction.
 * This is required for automatic subscription renewals with PayPal.
 * 
 * Documentation: https://developer.paypal.com/docs/api/subscriptions/v1/
 */
export class PayPalBillingService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Get PayPal access token
   */
  private async getAccessToken(credentials: PayPalCredentials, environment: 'sandbox' | 'live'): Promise<string> {
    const baseUrl = environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Create a PayPal subscription plan (one-time setup)
   * This should be done once and the plan ID stored in your configuration
   */
  async createSubscriptionPlan(
    credentials: PayPalCredentials,
    environment: 'sandbox' | 'live',
    planDetails: {
      name: string;
      description: string;
      priceCents: number;
      currency: string;
    }
  ): Promise<string> {
    const accessToken = await this.getAccessToken(credentials, environment);
    const baseUrl = environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    // First, create a product
    const productResponse = await fetch(`${baseUrl}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: planDetails.name,
        description: planDetails.description,
        type: 'SERVICE',
        category: 'SOFTWARE',
      }),
    });

    if (!productResponse.ok) {
      throw new Error('Failed to create PayPal product');
    }

    const product = await productResponse.json();

    // Then, create a billing plan
    const planResponse = await fetch(`${baseUrl}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product_id: product.id,
        name: planDetails.name,
        description: planDetails.description,
        billing_cycles: [
          {
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1,
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0, // 0 = infinite
            pricing_scheme: {
              fixed_price: {
                value: (planDetails.priceCents / 100).toFixed(2),
                currency_code: planDetails.currency,
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
        },
      }),
    });

    if (!planResponse.ok) {
      const error = await planResponse.text();
      throw new Error(`Failed to create PayPal billing plan: ${error}`);
    }

    const plan = await planResponse.json();
    return plan.id;
  }

  /**
   * Create a subscription for a user
   * Returns the approval URL where the user needs to approve the subscription
   */
  async createSubscription(
    credentials: PayPalCredentials,
    environment: 'sandbox' | 'live',
    params: {
      userId: string;
      planId: string; // PayPal plan ID from createSubscriptionPlan
      returnUrl: string;
      cancelUrl: string;
    }
  ): Promise<{ subscriptionId: string; approvalUrl: string }> {
    const accessToken = await this.getAccessToken(credentials, environment);
    const baseUrl = environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    const response = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: params.planId,
        custom_id: params.userId, // Store user ID for webhook processing
        application_context: {
          brand_name: 'PūrVita Network',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create PayPal subscription: ${error}`);
    }

    const subscription = await response.json();
    const approvalUrl = subscription.links.find((link: any) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new Error('PayPal approval URL not found');
    }

    return {
      subscriptionId: subscription.id,
      approvalUrl,
    };
  }

  /**
   * Save billing agreement to database after user approval
   */
  async saveBillingAgreement(
    userId: string,
    paypalSubscriptionId: string
  ): Promise<void> {
    const { error } = await this.client
      .from('paypal_billing_agreements')
      .insert({
        user_id: userId,
        paypal_subscription_id: paypalSubscriptionId,
        status: 'active',
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Get active billing agreement for a user
   */
  async getActiveBillingAgreement(userId: string): Promise<BillingAgreement | null> {
    const { data, error } = await this.client
      .from('paypal_billing_agreements')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      paypalBillingAgreementId: data.paypal_subscription_id,
      status: data.status,
      createdAt: data.created_at,
    };
  }

  /**
   * Cancel a billing agreement
   */
  async cancelBillingAgreement(
    credentials: PayPalCredentials,
    environment: 'sandbox' | 'live',
    subscriptionId: string,
    reason: string = 'User requested cancellation'
  ): Promise<void> {
    const accessToken = await this.getAccessToken(credentials, environment);
    const baseUrl = environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    const response = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        reason,
      }),
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(`Failed to cancel PayPal subscription: ${error}`);
    }

    // Update database
    await this.client
      .from('paypal_billing_agreements')
      .update({ status: 'cancelled' })
      .eq('paypal_subscription_id', subscriptionId);
  }

  /**
   * Process a renewal payment using the billing agreement
   * Note: With PayPal subscriptions, PayPal handles the recurring billing automatically.
   * You don't need to manually charge - PayPal will send webhooks when payments occur.
   */
  async processRenewal(
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const agreement = await this.getActiveBillingAgreement(userId);

    if (!agreement) {
      return {
        success: false,
        message: 'No active PayPal billing agreement found',
      };
    }

    // With PayPal subscriptions, the renewal is automatic
    // PayPal will charge the customer and send a webhook
    // We just need to verify the agreement is active
    return {
      success: true,
      message: 'PayPal will process renewal automatically',
    };
  }
}

