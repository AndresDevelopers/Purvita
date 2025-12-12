import { NextResponse } from 'next/server';
import { PaymentGatewayPublicInfoSchema } from '@/modules/payments/domain/models/payment-gateway';
import { createPaymentGatewayRepository } from '@/lib/factories/payment-gateway-factory';
import { handleApiError } from '@/lib/utils/api-error-handler';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';

export async function GET() {
  try {
    const repository = createPaymentGatewayRepository();
    const providers = await repository.listActiveGateways();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      let balanceCents = 0;

      try {
        const adminClient = createAdminClient();
        const walletService = new WalletService(adminClient);
        const wallet = await walletService.getBalance(user.id);
        balanceCents = wallet?.balance_cents ?? 0;
      } catch (walletError) {
        console.error('Failed to load wallet payment option', walletError);
      }

      providers.push({
        provider: 'wallet',
        mode: 'production',
        functionality: 'payment',
        clientId: null,
        publishableKey: null,
        availableOnAffiliateCheckout: true,
        availableOnMlmCheckout: true,
        availableOnMainStore: true,
        metadata: {
          type: 'wallet',
          walletBalanceCents: balanceCents,
          walletCurrency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
          requiresRedirect: false,
        },
      });
    }

    return NextResponse.json(PaymentGatewayPublicInfoSchema.array().parse(providers));
  } catch (error) {
    return handleApiError(error, 'Unable to load payment providers');
  }
}
