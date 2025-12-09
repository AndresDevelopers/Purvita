import { PaymentError, PaymentErrorCode } from '../utils/payment-errors';
import type { PaymentProvider } from '../domain/models/payment-gateway';
import type { PaymentResponse } from './payment-service';

export type PaymentFlowStatus = 'requires_action' | 'completed' | 'verification_required';

export interface PaymentFlowResult {
  provider: PaymentProvider;
  status: PaymentFlowStatus;
  redirectUrl?: string;
  verificationRequired?: boolean;
  verificationMessage?: string;
}

export interface SubscriptionCheckoutResponse {
  url?: string | null;
  status?: string | null;
}

const WALLET_SUCCESS_STATUSES = new Set(['completed', 'wallet_confirmed', 'success']);

export class PaymentFlowService {
  static normalizeGatewayResponse(
    provider: PaymentProvider,
    response: PaymentResponse,
  ): PaymentFlowResult {
    if (provider === 'wallet') {
      if (WALLET_SUCCESS_STATUSES.has(response.status)) {
        return { provider, status: 'completed' };
      }

      // Handle verification_required status from fraud detection
      if (response.status === 'verification_required') {
        return {
          provider,
          status: 'verification_required',
          verificationRequired: true,
          verificationMessage: (response as any).message || 'Additional verification required',
        };
      }

      throw new PaymentError(
        'Wallet payment did not complete successfully.',
        provider,
        PaymentErrorCode.PROVIDER_ERROR,
        { provider, scenario: response.status },
      );
    }

    const redirectUrl = response.url ?? response.approvalUrl ?? null;

    if (redirectUrl) {
      return { provider, status: 'requires_action', redirectUrl };
    }

    throw new PaymentError(
      'Missing payment redirect URL.',
      provider,
      PaymentErrorCode.PROVIDER_ERROR,
      { provider, scenario: response.status },
    );
  }

  static normalizeSubscriptionResponse(
    provider: PaymentProvider,
    response: SubscriptionCheckoutResponse,
  ): PaymentFlowResult {
    if (provider === 'wallet') {
      const status = response.status ?? undefined;
      if (status && WALLET_SUCCESS_STATUSES.has(status)) {
        return { provider, status: 'completed' };
      }

      throw new PaymentError(
        'Wallet subscription payment did not complete successfully.',
        provider,
        PaymentErrorCode.PROVIDER_ERROR,
        { provider, scenario: status },
      );
    }

    const redirectUrl = response.url ?? null;

    if (redirectUrl) {
      return { provider, status: 'requires_action', redirectUrl };
    }

    throw new PaymentError(
      'Missing subscription payment redirect URL.',
      provider,
      PaymentErrorCode.PROVIDER_ERROR,
      { provider, scenario: response.status ?? undefined },
    );
  }
}
