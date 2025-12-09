import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { Stripe as StripeTypes } from 'stripe';
import { SentryLogger } from '../../observability/services/sentry-logger';

type StripeClient = InstanceType<typeof Stripe>;
type StripePaymentMethodResource = StripeTypes['paymentMethods'];
type StripeSetupIntentsResource = StripeTypes['setupIntents'];
type StripeCustomersResource = StripeTypes['customers'];
type StripeApiClient = StripeClient & {
  paymentMethods: StripePaymentMethodResource;
  setupIntents: StripeSetupIntentsResource;
  customers: StripeCustomersResource;
};
import { PaymentMethodRepository } from '../repositories/payment-method-repository';
import type { PaymentMethod, CreatePaymentMethodInput, CardBrand, CardFunding } from '../domain/types';
import { GatewayCredentialsService } from '@/modules/payments/services/gateway-credentials-service';

export class PaymentMethodService {
  private readonly repository: PaymentMethodRepository;
  private stripeClientPromise: Promise<StripeApiClient> | null = null;

  constructor(private readonly client: SupabaseClient) {
    this.repository = new PaymentMethodRepository(client);
  }

  private async resolveStripeClient(): Promise<StripeApiClient> {
    try {
      const { credentials } = await GatewayCredentialsService.getActiveProviderCredentialsWithFallback('stripe');

      return new Stripe(credentials.secret_key, {
        apiVersion: '2025-03-31',
      }) as StripeApiClient;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Stripe credentials are not configured. Update them from the admin payment settings.',
      );
    }
  }

  private async getStripe(): Promise<StripeApiClient> {
    if (!this.stripeClientPromise) {
      this.stripeClientPromise = this.resolveStripeClient();
    }

    return this.stripeClientPromise;
  }

  async getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return this.repository.findByUserId(userId);
  }

  async getDefaultPaymentMethod(userId: string): Promise<PaymentMethod | null> {
    return this.repository.findDefaultByUserId(userId);
  }

  async addPaymentMethod(
    userId: string,
    stripePaymentMethodId: string,
    setAsDefault = false
  ): Promise<PaymentMethod> {
    const stripe = await this.getStripe();

    // Get user profile to get customer ID
    let customerId: string | null = null;
    try {
      const { data: profile } = await this.client
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();
      customerId = profile?.stripe_customer_id ?? null;
    } catch (_error) {
      console.warn('stripe_customer_id column not found');
    }

    if (!customerId) {
      throw new Error('User does not have a Stripe customer ID. Please try adding the card again.');
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(stripePaymentMethodId, {
      customer: customerId,
    });

    // Fetch payment method details from Stripe
    const stripePaymentMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

    // Extract card details
    const input: CreatePaymentMethodInput = {
      stripe_payment_method_id: stripePaymentMethodId,
      type: stripePaymentMethod.type as 'card' | 'bank_account',
      is_default: setAsDefault,
    };

    if (stripePaymentMethod.type === 'card' && stripePaymentMethod.card) {
      input.card_brand = stripePaymentMethod.card.brand as CardBrand;
      input.card_last4 = stripePaymentMethod.card.last4;
      input.card_exp_month = stripePaymentMethod.card.exp_month;
      input.card_exp_year = stripePaymentMethod.card.exp_year;
      input.card_funding = stripePaymentMethod.card.funding as CardFunding;
    }

    if (stripePaymentMethod.billing_details) {
      input.billing_name = stripePaymentMethod.billing_details.name ?? undefined;
      input.billing_email = stripePaymentMethod.billing_details.email ?? undefined;

      if (stripePaymentMethod.billing_details.address) {
        input.billing_address = {
          line1: stripePaymentMethod.billing_details.address.line1,
          line2: stripePaymentMethod.billing_details.address.line2,
          city: stripePaymentMethod.billing_details.address.city,
          state: stripePaymentMethod.billing_details.address.state,
          postal_code: stripePaymentMethod.billing_details.address.postal_code,
          country: stripePaymentMethod.billing_details.address.country,
        };
      }
    }

    // Check if already exists
    const existing = await this.repository.findByStripeId(stripePaymentMethodId);
    if (existing) {
      throw new Error('Payment method already added');
    }

    return this.repository.create(userId, input);
  }

  async setDefaultPaymentMethod(paymentMethodId: string, userId: string): Promise<PaymentMethod> {
    // Verify ownership
    const paymentMethod = await this.repository.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.user_id !== userId) {
      throw new Error('Payment method not found');
    }

    return this.repository.setDefault(paymentMethodId, userId);
  }

  async removePaymentMethod(paymentMethodId: string, userId: string): Promise<void> {
    // Verify ownership
    const paymentMethod = await this.repository.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.user_id !== userId) {
      throw new Error('Payment method not found');
    }

    // Detach from Stripe
    try {
      const stripe = await this.getStripe();
      await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);
    } catch (error) {
      SentryLogger.capturePaymentError(error, {
        operation: 'detach_payment_method',
        userId,
        extra: {
          paymentMethodId,
          stripePaymentMethodId: paymentMethod.stripe_payment_method_id,
          error,
        },
      });
      // Continue with deletion even if Stripe fails
    }

    await this.repository.delete(paymentMethodId, userId);
  }

  async createSetupIntent(userId: string): Promise<{ clientSecret: string }> {
    console.log('Creating setup intent for user:', userId);
    const stripe = await this.getStripe();
    console.log('Stripe client created');

    // Get or create Stripe customer
    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .single();

    console.log('Profile query result:', { profile, profileError });

    if (profileError) {
      throw new Error(`Profile query failed: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error('User profile not found');
    }

    console.log('Profile found:', profile);

    // Try to get stripe_customer_id, handle if column doesn't exist
    let customerId: string | null = null;
    try {
      const { data: customerData } = await this.client
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();
      customerId = customerData?.stripe_customer_id ?? null;
    } catch (_error) {
      // Column might not exist, ignore
      console.warn('stripe_customer_id column not found, will create customer');
    }

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.name,
        metadata: {
          user_id: userId,
        },
      });

      customerId = customer.id;

      // Update profile with customer ID (ignore if column doesn't exist)
      try {
        await this.client
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
      } catch (_error) {
        console.warn('Failed to update stripe_customer_id, column might not exist');
      }
    }

    // Create setup intent with customer
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        user_id: userId,
      },
    });

    return {
      clientSecret: setupIntent.client_secret!,
    };
  }
}
