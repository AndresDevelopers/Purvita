import type { PaymentGatewayPublicInfo } from '../domain/models/payment-gateway';

export interface WalletProviderMetadata {
  type: 'wallet';
  walletBalanceCents: number;
  walletCurrency: string;
  requiresRedirect?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getWalletMetadata = (
  provider: PaymentGatewayPublicInfo,
): WalletProviderMetadata | null => {
  const meta = provider.metadata;
  if (!isRecord(meta)) {
    return null;
  }

  const type = typeof meta.type === 'string' ? (meta.type as string) : null;
  const balance = meta.walletBalanceCents;
  const currency = meta.walletCurrency;

  if (
    (type === 'wallet' || provider.provider === 'wallet') &&
    typeof balance === 'number' &&
    typeof currency === 'string'
  ) {
    return {
      type: 'wallet',
      walletBalanceCents: balance,
      walletCurrency: currency,
      requiresRedirect: typeof meta.requiresRedirect === 'boolean' ? meta.requiresRedirect : false,
    };
  }

  return null;
};

export const providerRequiresRedirect = (provider: PaymentGatewayPublicInfo): boolean => {
  const meta = provider.metadata;
  if (isRecord(meta) && typeof meta.requiresRedirect === 'boolean') {
    return meta.requiresRedirect;
  }

  return provider.provider !== 'wallet';
};

export const isWalletProvider = (
  provider: PaymentGatewayPublicInfo,
): provider is PaymentGatewayPublicInfo & { metadata: WalletProviderMetadata } => {
  return getWalletMetadata(provider) !== null;
};
