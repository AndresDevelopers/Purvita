import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { NetworkEarningsRepository } from '@/modules/multilevel/repositories/network-earnings-repository';
import {
  PayoutAccountRepository,
  type PayoutAccountRecord,
  type PayoutProvider,
} from '@/modules/multilevel/repositories/payout-account-repository';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { PaymentGatewayRecordSchema } from '@/modules/payments/domain/models/payment-gateway';
import { getEnvironmentFallbackProviderIds } from '@/modules/payments/utils/environment-fallback-providers';
import { PayoutPreferencesRepository } from '../repositories/payout-preferences-repository';

const STRIPE_ACCOUNT_PREFIX = 'acct_';
const FALLBACK_MIN_AUTO_PAYOUT_CENTS = 900; // Fallback if schedule not configured
const MAX_AUTO_PAYOUT_CENTS = 100_000_000; // $1,000,000.00

const generateStripeAccountId = () => {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return `${STRIPE_ACCOUNT_PREFIX}${random}`;
};

const PAYPAL_CONNECT_SCHEMA = z.object({
  email: z.string().email('PayPal email is invalid').transform((value) => value.trim().toLowerCase()),
});

export class ProfileEarningsService {
  private readonly networkEarnings: NetworkEarningsRepository;
  private readonly payoutAccounts: PayoutAccountRepository;
  private readonly wallets: WalletService;
  private readonly payoutPreferences: PayoutPreferencesRepository;

  constructor(private readonly client: SupabaseClient) {
    this.networkEarnings = new NetworkEarningsRepository(client);
    this.payoutAccounts = new PayoutAccountRepository(client);
    this.wallets = new WalletService(client);
    this.payoutPreferences = new PayoutPreferencesRepository(client);
  }

  /**
   * Get the minimum payout amount from payment schedule settings
   * Falls back to FALLBACK_MIN_AUTO_PAYOUT_CENTS if not configured
   */
  private async getMinimumPayoutCents(): Promise<number> {
    try {
      const { data, error } = await this.client
        .from('payment_schedule_settings')
        .select('default_amount_cents')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return FALLBACK_MIN_AUTO_PAYOUT_CENTS;
      }

      return Math.max(data.default_amount_cents, FALLBACK_MIN_AUTO_PAYOUT_CENTS);
    } catch {
      return FALLBACK_MIN_AUTO_PAYOUT_CENTS;
    }
  }

  /**
   * Get the payment mode from payment schedule settings
   * Returns 'automatic' if not configured
   */
  private async getPaymentMode(): Promise<'manual' | 'automatic'> {
    try {
      const { data, error } = await this.client
        .from('payment_schedule_settings')
        .select('payment_mode')
        .limit(1)
        .maybeSingle();

      if (error || !data || !data.payment_mode) {
        return 'automatic'; // Default to automatic for backward compatibility
      }

      return data.payment_mode as 'manual' | 'automatic';
    } catch {
      return 'automatic';
    }
  }

  private async getActivePayoutProviders(): Promise<PayoutProvider[]> {
    const fallbackProviders = getEnvironmentFallbackProviderIds().filter(
      (provider): provider is PayoutProvider =>
        provider === 'stripe' || provider === 'paypal' || provider === 'authorize_net' || provider === 'payoneer',
    );

    try {
      const { data, error } = await this.client
        .from('payment_gateways')
        .select('*')
        .eq('is_active', true)
        .in('provider', ['stripe', 'paypal', 'authorize_net', 'payoneer']);

      if (error) {
        throw error;
      }

      const records = (data ?? []).map((row) => PaymentGatewayRecordSchema.parse(row));

      // Now credentials are read from environment variables
      // We just need to check if the provider is active and has payout functionality
      const activeProviders = records
        .filter((record) => {
          // Check if provider supports payout functionality
          const functionality = record.functionality || 'payment';
          return functionality === 'payout' || functionality === 'both';
        })
        .map((record) => record.provider as PayoutProvider);

      const providers = new Set<PayoutProvider>([...activeProviders, ...fallbackProviders]);
      return Array.from(providers);
    } catch (error) {
      if (fallbackProviders.length > 0) {
        return Array.from(new Set<PayoutProvider>(fallbackProviders));
      }

      throw error;
    }
  }

  private async ensureProviderEnabled(provider: PayoutProvider) {
    const activeProviders = await this.getActivePayoutProviders();
    if (!activeProviders.includes(provider)) {
      const providerNames: Record<PayoutProvider, string> = {
        stripe: 'Stripe',
        paypal: 'PayPal',
        authorize_net: 'Authorize.Net',
        payoneer: 'Payoneer',
      };
      throw new Error(`${providerNames[provider]} payouts are not enabled.`);
    }
  }

  private assertCompatibleProvider(existing: PayoutAccountRecord | null, provider: PayoutProvider) {
    if (existing && existing.provider !== provider) {
      throw new Error('Another payout provider is already connected for this user.');
    }
  }

  async ensureStripeAccount(userId: string) {
    const existing = await this.payoutAccounts.findByUserId(userId);
    this.assertCompatibleProvider(existing, 'stripe');
    await this.ensureProviderEnabled('stripe');

    if (existing) {
      if (existing.status !== 'active') {
        const updated = await this.payoutAccounts.updateAccount(userId, 'stripe', { status: 'active' });
        return { account: updated ?? { ...existing, status: 'active' }, created: false } as const;
      }

      return { account: existing, created: false } as const;
    }

    const accountId = generateStripeAccountId();
    const account = await this.payoutAccounts.createAccount(userId, 'stripe', accountId, 'active');

    return { account, created: true };
  }

  async connectPaypalAccount(userId: string, payload: unknown) {
    const parseResult = PAYPAL_CONNECT_SCHEMA.safeParse(payload);
    if (!parseResult.success) {
      throw new Error(parseResult.error.issues[0]?.message ?? 'PayPal email is invalid');
    }

    const { email } = parseResult.data;
    const existing = await this.payoutAccounts.findByUserId(userId);
    this.assertCompatibleProvider(existing, 'paypal');
    await this.ensureProviderEnabled('paypal');

    if (existing) {
      if (existing.account_id === email && existing.status === 'active') {
        return { account: existing, created: false };
      }

      const updated = await this.payoutAccounts.updateAccount(userId, 'paypal', {
        account_id: email,
        status: 'active',
      });

      return { account: updated ?? existing, created: !existing.account_id };
    }

    const account = await this.payoutAccounts.createAccount(userId, 'paypal', email, 'active');
    return { account, created: true };
  }

  async connectAuthorizeNetAccount(userId: string, payload: unknown) {
    const schema = z.object({
      routingNumber: z.string().min(9, 'Routing number must be at least 9 digits').max(9, 'Routing number must be 9 digits'),
      accountNumber: z.string().min(4, 'Account number must be at least 4 digits').max(17, 'Account number is too long'),
      accountHolderName: z.string().min(2, 'Account holder name is required').max(100, 'Account holder name is too long'),
    });

    const parseResult = schema.safeParse(payload);
    if (!parseResult.success) {
      throw new Error(parseResult.error.issues[0]?.message ?? 'Invalid bank account information');
    }

    const { routingNumber, accountNumber, accountHolderName } = parseResult.data;
    // Store as routing:account:name format
    const accountId = `${routingNumber}:${accountNumber}:${accountHolderName}`;

    const existing = await this.payoutAccounts.findByUserId(userId);
    this.assertCompatibleProvider(existing, 'authorize_net');
    await this.ensureProviderEnabled('authorize_net');

    if (existing) {
      if (existing.account_id === accountId && existing.status === 'active') {
        return { account: existing, created: false };
      }

      const updated = await this.payoutAccounts.updateAccount(userId, 'authorize_net', {
        account_id: accountId,
        status: 'active',
      });

      return { account: updated ?? existing, created: !existing.account_id };
    }

    const account = await this.payoutAccounts.createAccount(userId, 'authorize_net', accountId, 'active');
    return { account, created: true };
  }

  async connectPayoneerAccount(userId: string, payload: unknown) {
    const schema = z.object({
      payeeId: z.string().min(1, 'Payoneer Payee ID is required').max(100, 'Payoneer Payee ID is too long'),
    });

    const parseResult = schema.safeParse(payload);
    if (!parseResult.success) {
      throw new Error(parseResult.error.issues[0]?.message ?? 'Invalid Payoneer Payee ID');
    }

    const { payeeId } = parseResult.data;

    const existing = await this.payoutAccounts.findByUserId(userId);
    this.assertCompatibleProvider(existing, 'payoneer');
    await this.ensureProviderEnabled('payoneer');

    if (existing) {
      if (existing.account_id === payeeId && existing.status === 'active') {
        return { account: existing, created: false };
      }

      const updated = await this.payoutAccounts.updateAccount(userId, 'payoneer', {
        account_id: payeeId,
        status: 'active',
      });

      return { account: updated ?? existing, created: !existing.account_id };
    }

    const account = await this.payoutAccounts.createAccount(userId, 'payoneer', payeeId, 'active');
    return { account, created: true };
  }

  async disconnectPayoutAccount(userId: string) {
    const existing = await this.payoutAccounts.findByUserId(userId);

    if (!existing) {
      return { removed: false } as const;
    }

    await this.payoutAccounts.deleteAccount(userId);

    return { removed: true, previous: existing } as const;
  }

  async transferToWallet(userId: string, amountCents: number) {
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error('Invalid transfer amount');
    }

    const summary = await this.networkEarnings.fetchAvailableSummary(userId);
    if (summary.totalAvailableCents < amountCents) {
      throw new Error('Insufficient available earnings');
    }

    const decremented = await this.networkEarnings.decrementAvailable(userId, amountCents);

    await this.wallets.addFunds(userId, amountCents, 'sale_commission', undefined, undefined, {
      source: 'network_earnings',
      breakdown: decremented,
    });

    const updatedSummary = await this.networkEarnings.fetchAvailableSummary(userId);
    const wallet = await this.wallets.getBalance(userId);

    return {
      transferredCents: amountCents,
      networkEarnings: updatedSummary,
      wallet,
    };
  }

  /**
   * Procesa un pago automático si el usuario tiene más de $9 disponibles
   * y tiene una cuenta de Stripe Connect activa
   */
  async processAutoPayout(userId: string) {
    const minimumCents = await this.getMinimumPayoutCents();
    const paymentMode = await this.getPaymentMode();
    const thresholdCents = await this.resolveAutoPayoutThreshold(userId);

    // Verificar que el modo de pago sea automático
    if (paymentMode === 'manual') {
      throw new Error('Automatic payouts are disabled. Payment mode is set to manual by administrator.');
    }

    // Verificar cuenta de pago
    const payoutAccount = await this.payoutAccounts.findByUserId(userId);

    if (!payoutAccount) {
      throw new Error('No payout account configured');
    }

    if (payoutAccount.provider !== 'stripe' && payoutAccount.provider !== 'paypal' &&
      payoutAccount.provider !== 'authorize_net' && payoutAccount.provider !== 'payoneer') {
      throw new Error('Auto payout only available for Stripe, PayPal, Authorize.Net, and Payoneer accounts');
    }

    if (payoutAccount.status !== 'active') {
      throw new Error(`${payoutAccount.provider} account status is ${payoutAccount.status}. Must be active to process payouts.`);
    }

    if (!payoutAccount.account_id) {
      throw new Error(`${payoutAccount.provider} account ID is missing`);
    }

    // Verificar saldo disponible
    const summary = await this.networkEarnings.fetchAvailableSummary(userId);

    if (summary.totalAvailableCents < thresholdCents) {
      return {
        processed: false,
        reason: 'below_threshold',
        message: `Minimum payout amount is $${(thresholdCents / 100).toFixed(2)}. Current available: $${(summary.totalAvailableCents / 100).toFixed(2)}`,
        availableCents: summary.totalAvailableCents,
        minimumCents,
        thresholdCents,
      };
    }

    // Procesar el pago con Stripe o PayPal
    try {
      let payoutResult: { id: string; arrival_date: string };

      if (payoutAccount.provider === 'stripe') {
        payoutResult = await this.processStripePayout(
          payoutAccount.account_id,
          summary.totalAvailableCents,
          userId,
        );
      } else if (payoutAccount.provider === 'paypal') {
        payoutResult = await this.processPaypalPayout(
          payoutAccount.account_id,
          summary.totalAvailableCents,
          userId,
        );
      } else if (payoutAccount.provider === 'authorize_net') {
        payoutResult = await this.processAuthorizeNetPayout(
          payoutAccount.account_id,
          summary.totalAvailableCents,
          userId,
        );
      } else {
        // Payoneer
        payoutResult = await this.processPayoneerPayout(
          payoutAccount.account_id,
          summary.totalAvailableCents,
          userId,
        );
      }

      // Decrementar el saldo disponible
      await this.networkEarnings.decrementAvailable(userId, summary.totalAvailableCents);

      // Registrar la transacción
      await this.recordPayoutTransaction(userId, summary.totalAvailableCents, payoutResult, payoutAccount.provider);

      return {
        processed: true,
        amountCents: summary.totalAvailableCents,
        payoutId: payoutResult.id,
        estimatedArrival: payoutResult.arrival_date,
        thresholdCents,
        provider: payoutAccount.provider,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to process ${payoutAccount.provider} payout`;
      throw new Error(`Payout failed: ${message}`);
    }
  }

  /**
   * Procesa un pago a través de Stripe Connect
   * Transfiere fondos desde la cuenta del admin (platform) a la cuenta conectada del usuario
   */
  private async processStripePayout(
    stripeAccountId: string,
    amountCents: number,
    userId: string,
  ): Promise<{ id: string; arrival_date: string }> {
    // Obtener las credenciales de Stripe desde payment_gateways
    const { data: gateway, error: gatewayError } = await this.client
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'stripe')
      .eq('is_active', true)
      .single();

    let stripeSecretKey: string;

    if (gatewayError || !gateway) {
      // Usar variable de entorno como fallback
      stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
    } else {
      const mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
      stripeSecretKey = mode === 'test'
        ? gateway.credentials.testSecret || ''
        : gateway.credentials.secret || '';
    }

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key is not configured');
    }

    // Crear el pago usando la API de Stripe con timeout e idempotencia
    // Usamos un Transfer para mover fondos desde la cuenta platform (admin) a la cuenta conectada (usuario)
    try {
      // Generate idempotency key to prevent duplicate transfers
      const idempotencyKey = `payout_${userId}_${amountCents}_${new Date().toISOString().slice(0, 10)}`;

      const response = await fetch('https://api.stripe.com/v1/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': idempotencyKey,
        },
        body: new URLSearchParams({
          amount: amountCents.toString(),
          currency: 'usd',
          destination: stripeAccountId,
          description: `Payout for user ${userId}`,
          'metadata[user_id]': userId,
          'metadata[source]': 'network_earnings',
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Stripe transfer error:', errorData);
        throw new Error(errorData.error?.message || 'Failed to create Stripe transfer');
      }

      const transfer = await response.json();

      // Calcular fecha estimada de llegada (2 días hábiles)
      const arrivalDate = new Date();
      arrivalDate.setDate(arrivalDate.getDate() + 2);

      return {
        id: transfer.id,
        arrival_date: arrivalDate.toISOString(),
      };
    } catch (error) {
      console.error('Error processing Stripe payout:', error);
      throw error;
    }
  }

  /**
   * Procesa un pago a través de PayPal Payouts API
   * Transfiere fondos desde la cuenta del admin (platform) a la cuenta de PayPal del usuario
   */
  private async processPaypalPayout(
    paypalEmail: string,
    amountCents: number,
    userId: string,
  ): Promise<{ id: string; arrival_date: string }> {
    // Obtener las credenciales de PayPal desde payment_gateways
    const { data: gateway, error: gatewayError } = await this.client
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'paypal')
      .eq('is_active', true)
      .single();

    let paypalClientId: string;
    let paypalSecret: string;
    let paypalMode: 'test' | 'production';

    if (gatewayError || !gateway) {
      // Usar variable de entorno como fallback
      paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
      paypalSecret = process.env.PAYPAL_CLIENT_SECRET || '';
      paypalMode = (process.env.PAYPAL_MODE === 'live' ? 'production' : 'test') as 'test' | 'production';
    } else {
      const mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
      paypalMode = mode;
      paypalClientId = mode === 'test'
        ? gateway.credentials.testClientId || ''
        : gateway.credentials.clientId || '';
      paypalSecret = mode === 'test'
        ? gateway.credentials.testSecret || ''
        : gateway.credentials.secret || '';
    }

    if (!paypalClientId || !paypalSecret) {
      throw new Error('PayPal credentials are not configured');
    }

    // PayPal API URL (sandbox o production)
    const apiBaseUrl = paypalMode === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    try {
      // Primero obtener un access token de PayPal con timeout
      const tokenResponse = await fetch(`${apiBaseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        console.error('PayPal auth error:', errorData);
        throw new Error('Failed to authenticate with PayPal');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Crear el payout usando PayPal Payouts API con timeout
      const payoutAmount = (amountCents / 100).toFixed(2);
      const payoutId = `payout_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

      const payoutResponse = await fetch(`${apiBaseUrl}/v1/payments/payouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: payoutId,
            email_subject: 'You have a payout!',
            email_message: 'You have received a payout from your network earnings.',
          },
          items: [
            {
              recipient_type: 'EMAIL',
              amount: {
                value: payoutAmount,
                currency: 'USD',
              },
              receiver: paypalEmail,
              note: `Payout for user ${userId}`,
              sender_item_id: userId,
            },
          ],
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!payoutResponse.ok) {
        const errorData = await payoutResponse.json().catch(() => ({}));
        console.error('PayPal payout error:', errorData);
        throw new Error(errorData.message || 'Failed to create PayPal payout');
      }

      const payoutData = await payoutResponse.json();

      // Calcular fecha estimada de llegada (2-3 días hábiles para PayPal)
      const arrivalDate = new Date();
      arrivalDate.setDate(arrivalDate.getDate() + 3);

      return {
        id: payoutData.batch_header.payout_batch_id,
        arrival_date: arrivalDate.toISOString(),
      };
    } catch (error) {
      console.error('Error processing PayPal payout:', error);
      throw error;
    }
  }

  /**
   * Procesa un pago a través de Authorize.Net
   * Transfiere fondos desde la cuenta del admin a la cuenta bank account del usuario
   */
  private async processAuthorizeNetPayout(
    accountId: string,
    amountCents: number,
    userId: string,
  ): Promise<{ id: string; arrival_date: string }> {
    // Obtener las credenciales de Authorize.Net desde payment_gateways
    const { data: gateway, error: gatewayError } = await this.client
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'authorize_net')
      .eq('is_active', true)
      .single();

    let apiLoginId: string;
    let transactionKey: string;
    let mode: 'test' | 'production';

    if (gatewayError || !gateway) {
      // Usar variable de entorno como fallback
      apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID || '';
      transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY || '';
      mode = (process.env.AUTHORIZE_NET_MODE === 'production' ? 'production' : 'test') as 'test' | 'production';
    } else {
      mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
      apiLoginId = mode === 'test'
        ? gateway.credentials.testClientId || ''
        : gateway.credentials.clientId || '';
      transactionKey = mode === 'test'
        ? gateway.credentials.testSecret || ''
        : gateway.credentials.secret || '';
    }

    if (!apiLoginId || !transactionKey) {
      throw new Error('Authorize.Net credentials are not configured');
    }

    // Authorize.Net API URL (sandbox o production)
    const apiBaseUrl = mode === 'production'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    try {
      const payoutId = `payout_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const amount = (amountCents / 100).toFixed(2);

      // Crear la solicitud de pago usando la API de Authorize.Net
      const response = await fetch(apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createTransactionRequest: {
            merchantAuthentication: {
              name: apiLoginId,
              transactionKey: transactionKey,
            },
            refId: payoutId,
            transactionRequest: {
              transactionType: 'refundTransaction',
              amount: amount,
              payment: {
                bankAccount: {
                  accountType: 'checking',
                  routingNumber: accountId.split(':')[0] || '',
                  accountNumber: accountId.split(':')[1] || '',
                  nameOnAccount: accountId.split(':')[2] || `User ${userId}`,
                },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Authorize.Net payout error:', errorData);
        throw new Error('Failed to create Authorize.Net payout');
      }

      const result = await response.json();

      if (result.messages?.resultCode !== 'Ok') {
        console.error('Authorize.Net API error:', result);
        throw new Error(result.messages?.message?.[0]?.text || 'Authorize.Net payout failed');
      }

      // Calcular fecha estimada de llegada (3-5 días hábiles para ACH)
      const arrivalDate = new Date();
      arrivalDate.setDate(arrivalDate.getDate() + 5);

      return {
        id: result.transactionResponse?.transId || payoutId,
        arrival_date: arrivalDate.toISOString(),
      };
    } catch (error) {
      console.error('Error processing Authorize.Net payout:', error);
      throw error;
    }
  }

  /**
   * Procesa un pago a través de Payoneer
   * Transfiere fondos desde la cuenta del admin a la cuenta de Payoneer del usuario
   */
  private async processPayoneerPayout(
    payoneerPayeeId: string,
    amountCents: number,
    userId: string,
  ): Promise<{ id: string; arrival_date: string }> {
    // Obtener las credenciales de Payoneer desde payment_gateways
    const { data: gateway, error: gatewayError } = await this.client
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'payoneer')
      .eq('is_active', true)
      .single();

    let programId: string;
    let username: string;
    let password: string;
    let mode: 'test' | 'production';

    if (gatewayError || !gateway) {
      // Usar variable de entorno como fallback
      programId = process.env.PAYONEER_PROGRAM_ID || '';
      username = process.env.PAYONEER_USERNAME || '';
      password = process.env.PAYONEER_PASSWORD || '';
      mode = (process.env.PAYONEER_MODE === 'production' ? 'production' : 'test') as 'test' | 'production';
    } else {
      mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
      programId = mode === 'test'
        ? gateway.credentials.testClientId || ''
        : gateway.credentials.clientId || '';
      username = mode === 'test'
        ? gateway.credentials.testPublishableKey || ''
        : gateway.credentials.publishableKey || '';
      password = mode === 'test'
        ? gateway.credentials.testSecret || ''
        : gateway.credentials.secret || '';
    }

    if (!programId || !username || !password) {
      throw new Error('Payoneer credentials are not configured');
    }

    // Payoneer API URL (sandbox o production)
    const apiBaseUrl = mode === 'production'
      ? 'https://api.payoneer.com/v2/programs'
      : 'https://api.sandbox.payoneer.com/v2/programs';

    try {
      const payoutId = `payout_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const amount = (amountCents / 100).toFixed(2);

      // Crear la solicitud de pago usando la API de Payoneer
      const response = await fetch(`${apiBaseUrl}/${programId}/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        },
        body: JSON.stringify({
          payee_id: payoneerPayeeId,
          amount: amount,
          currency: 'USD',
          client_reference_id: payoutId,
          description: `Payout for user ${userId}`,
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Payoneer payout error:', errorData);
        throw new Error(errorData.description || 'Failed to create Payoneer payout');
      }

      const result = await response.json();

      // Calcular fecha estimada de llegada (2-3 días hábiles para Payoneer)
      const arrivalDate = new Date();
      arrivalDate.setDate(arrivalDate.getDate() + 3);

      return {
        id: result.payout_id || payoutId,
        arrival_date: arrivalDate.toISOString(),
      };
    } catch (error) {
      console.error('Error processing Payoneer payout:', error);
      throw error;
    }
  }

  /**
   * Registra la transacción de pago en la base de datos
   */
  private async recordPayoutTransaction(
    userId: string,
    amountCents: number,
    payoutResult: { id: string; arrival_date: string },
    provider: 'stripe' | 'paypal' | 'authorize_net' | 'payoneer',
  ) {
    // Registrar en una tabla de transacciones de payout
    // Esto requeriría una nueva tabla payout_transactions
    const { error } = await this.client.from('payout_transactions').insert({
      user_id: userId,
      amount_cents: amountCents,
      currency: 'USD',
      provider,
      external_id: payoutResult.id,
      status: 'pending',
      estimated_arrival: payoutResult.arrival_date,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Si la tabla no existe, solo logueamos el error pero no fallamos
      console.warn('Failed to record payout transaction:', error);
    }
  }

  /**
   * Obtiene el estado de configuración de pagos automáticos
   */
  async getAutoPayoutStatus(userId: string) {
    const minimumCents = await this.getMinimumPayoutCents();
    const paymentMode = await this.getPaymentMode();
    const payoutAccount = await this.payoutAccounts.findByUserId(userId);
    const summary = await this.networkEarnings.fetchAvailableSummary(userId);
    const thresholdCents = await this.resolveAutoPayoutThreshold(userId);

    // Auto-payout is only enabled if payment mode is automatic
    const isAutoPayoutEnabled =
      paymentMode === 'automatic' &&
      (payoutAccount?.provider === 'stripe' || payoutAccount?.provider === 'paypal' ||
        payoutAccount?.provider === 'authorize_net' || payoutAccount?.provider === 'payoneer') &&
      payoutAccount?.status === 'active';

    const isEligible =
      isAutoPayoutEnabled &&
      summary.totalAvailableCents >= thresholdCents;

    return {
      enabled: isAutoPayoutEnabled,
      eligible: isEligible,
      availableCents: summary.totalAvailableCents,
      minimumCents,
      thresholdCents,
      paymentMode,
      payoutAccount: payoutAccount
        ? {
          provider: payoutAccount.provider,
          status: payoutAccount.status,
          account_id: payoutAccount.account_id,
        }
        : null,
    };
  }

  async updateAutoPayoutThreshold(userId: string, payload: unknown) {
    const minimumCents = await this.getMinimumPayoutCents();

    const schema = z.object({
      thresholdCents: z
        .number({ invalid_type_error: 'thresholdCents must be a number' })
        .int('Threshold must be a whole number of cents')
        .min(minimumCents, `Threshold must be at least $${(minimumCents / 100).toFixed(2)}`)
        .max(
          MAX_AUTO_PAYOUT_CENTS,
          `Threshold must be less than or equal to $${(MAX_AUTO_PAYOUT_CENTS / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        ),
    });

    const result = schema.safeParse(payload);

    if (!result.success) {
      throw new Error(result.error.issues[0]?.message ?? 'Invalid threshold payload');
    }

    const { thresholdCents } = result.data;

    await this.payoutPreferences.upsertThreshold(userId, thresholdCents);

    return this.getAutoPayoutStatus(userId);
  }

  private async resolveAutoPayoutThreshold(userId: string) {
    const minimumCents = await this.getMinimumPayoutCents();
    const record = await this.payoutPreferences.findByUserId(userId);
    const configured = record?.auto_payout_threshold_cents ?? minimumCents;
    return Math.max(minimumCents, configured);
  }
}
