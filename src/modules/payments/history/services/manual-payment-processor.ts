import type { SupabaseClient } from '@supabase/supabase-js';
import { GatewayCredentialsService } from '@/modules/payments/services/gateway-credentials-service';
import type { PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';
import { WalletService } from '@/modules/multilevel/services/wallet-service';

export interface ManualPaymentProcessRequest {
  userId: string;
  amountCents: number;
  currency: string;
  provider: PaymentProvider;
  description?: string;
  adminId: string;
}

export interface ManualPaymentProcessResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  provider: PaymentProvider;
}

/**
 * Service to process manual payments using admin-configured payment providers
 * This charges the admin's payment account and credits the user
 */
export class ManualPaymentProcessor {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Process a manual payment to a user using the configured payment provider
   * For Stripe/PayPal: Creates a transfer/payout to the user
   * For Wallet: Directly credits the user's wallet
   */
  async processPayment(request: ManualPaymentProcessRequest): Promise<ManualPaymentProcessResult> {
    const { userId, amountCents, currency, provider, description, adminId } = request;

    try {
      switch (provider) {
        case 'stripe':
          return await this.processStripePayment(userId, amountCents, currency, description, adminId);
        
        case 'paypal':
          return await this.processPayPalPayment(userId, amountCents, currency, description, adminId);
        
        case 'wallet':
          return await this.processWalletPayment(userId, amountCents, description, adminId);
        
        default:
          return {
            success: false,
            error: `Unsupported payment provider: ${provider}`,
            provider,
          };
      }
    } catch (error) {
      console.error('[ManualPaymentProcessor] Payment processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
        provider,
      };
    }
  }

  /**
   * Process payment via Stripe
   * Note: This requires the user to have a Stripe Connect account configured
   */
  private async processStripePayment(
    userId: string,
    amountCents: number,
    currency: string,
    description?: string,
    adminId?: string
  ): Promise<ManualPaymentProcessResult> {
    try {
      // Get Stripe credentials
      const { credentials, record } = await GatewayCredentialsService.getProviderCredentials('stripe', 'auto');

      if (record.status !== 'active') {
        throw new Error('Stripe is not active');
      }

      // Get user's payout account (Stripe Connect account)
      const { data: payoutAccount, error: accountError } = await this.client
        .from('payout_accounts')
        .select('account_id, provider, status')
        .eq('user_id', userId)
        .eq('provider', 'stripe')
        .eq('status', 'active')
        .maybeSingle();

      if (accountError || !payoutAccount || !payoutAccount.account_id) {
        throw new Error('User does not have an active Stripe Connect account');
      }

      // Create a transfer to the user's Stripe Connect account
      const transferResponse = await fetch('https://api.stripe.com/v1/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${credentials.secret_key}`,
        },
        body: new URLSearchParams({
          amount: amountCents.toString(),
          currency: currency.toLowerCase(),
          destination: payoutAccount.account_id,
          description: description || 'Manual payout from admin',
          metadata: JSON.stringify({
            user_id: userId,
            admin_id: adminId || 'system',
            type: 'manual_payout',
          }),
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json();
        throw new Error(errorData.error?.message || 'Stripe transfer failed');
      }

      const transfer = await transferResponse.json();

      return {
        success: true,
        transactionId: transfer.id,
        provider: 'stripe',
      };
    } catch (error) {
      throw new Error(`Stripe payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process payment via PayPal
   * Note: This requires the user to have a PayPal account email configured
   */
  private async processPayPalPayment(
    userId: string,
    amountCents: number,
    currency: string,
    description?: string,
    _adminId?: string
  ): Promise<ManualPaymentProcessResult> {
    try {
      // Get PayPal credentials
      const { credentials, record } = await GatewayCredentialsService.getProviderCredentials('paypal', 'auto');

      if (record.status !== 'active') {
        throw new Error('PayPal is not active');
      }

      // Get user's payout account (PayPal email)
      const { data: payoutAccount, error: accountError } = await this.client
        .from('payout_accounts')
        .select('account_id, provider, status')
        .eq('user_id', userId)
        .eq('provider', 'paypal')
        .eq('status', 'active')
        .maybeSingle();

      if (accountError || !payoutAccount || !payoutAccount.account_id) {
        throw new Error('User does not have an active PayPal account');
      }

      const baseUrl = credentials.secret_key?.includes('sandbox')
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

      // Get PayPal access token
      const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${credentials.client_id}:${credentials.secret_key}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!authResponse.ok) {
        throw new Error('PayPal authentication failed');
      }

      const authData = await authResponse.json();
      const accessToken = authData.access_token;

      // Create payout
      const payoutResponse = await fetch(`${baseUrl}/v1/payments/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: `manual-payout-${Date.now()}-${userId}`,
            email_subject: 'You have a payment',
            email_message: description || 'You have received a payment',
          },
          items: [
            {
              recipient_type: 'EMAIL',
              amount: {
                value: (amountCents / 100).toFixed(2),
                currency: currency.toUpperCase(),
              },
              receiver: payoutAccount.account_id, // PayPal email
              note: description || 'Manual payout from admin',
              sender_item_id: `item-${userId}-${Date.now()}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!payoutResponse.ok) {
        const errorData = await payoutResponse.json();
        throw new Error(errorData.message || 'PayPal payout failed');
      }

      const payout = await payoutResponse.json();

      return {
        success: true,
        transactionId: payout.batch_header.payout_batch_id,
        provider: 'paypal',
      };
    } catch (error) {
      throw new Error(`PayPal payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process payment via Wallet
   * Directly credits the user's wallet balance
   */
  private async processWalletPayment(
    userId: string,
    amountCents: number,
    description?: string,
    adminId?: string
  ): Promise<ManualPaymentProcessResult> {
    try {
      const walletService = new WalletService(this.client);

      // Add funds to user's wallet
      await walletService.addFunds(
        userId,
        amountCents,
        'admin_adjustment',
        adminId,
        description || 'Manual payout from admin',
        {
          source: 'manual-payment',
          type: 'payout',
        }
      );

      return {
        success: true,
        transactionId: `wallet-${Date.now()}-${userId}`,
        provider: 'wallet',
      };
    } catch (error) {
      throw new Error(`Wallet payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

