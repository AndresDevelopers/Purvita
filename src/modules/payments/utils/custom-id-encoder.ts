/**
 * Custom ID Encoder for Payment Metadata
 * Encodes payment metadata into provider-specific custom ID fields
 */

import { randomUUID } from 'node:crypto';

const MAX_CUSTOM_ID_LENGTH = 127;

export enum PaymentIntent {
  WALLET_RECHARGE = 'wallet_recharge',
  CHECKOUT = 'checkout',
}

export interface WalletRechargeMetadata {
  intent: PaymentIntent.WALLET_RECHARGE;
  userId: string;
  rechargeId?: string;
  currency?: string;
}

export interface CheckoutMetadata {
  intent: PaymentIntent.CHECKOUT;
  userId: string;
  phaseRewardType?: 'free_product' | 'store_credit';
  phaseRewardDiscountCents?: number;
}

export type PaymentMetadata = WalletRechargeMetadata | CheckoutMetadata;

/**
 * Encode payment metadata into a custom ID string
 * Format: intent:userId:additionalData
 */
export function encodeCustomId(metadata: Record<string, unknown> | null | undefined, fallbackUserId?: string): string | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const intent = typeof metadata.intent === 'string' ? metadata.intent : null;
  const userId = typeof metadata.userId === 'string' ? metadata.userId : fallbackUserId;

  if (!intent || !userId) {
    return undefined;
  }

  let customId: string;

  switch (intent) {
    case PaymentIntent.WALLET_RECHARGE: {
      const rechargeId = typeof metadata.rechargeId === 'string' ? metadata.rechargeId : randomUUID();
      customId = `${PaymentIntent.WALLET_RECHARGE}:${userId}:${rechargeId}`;
      break;
    }

    case PaymentIntent.CHECKOUT: {
      if ('phaseRewardType' in metadata && 'phaseRewardDiscountCents' in metadata) {
        const rewardType = metadata.phaseRewardType as string;
        const discountCents = metadata.phaseRewardDiscountCents as number;
        customId = `${PaymentIntent.CHECKOUT}:${userId}:${rewardType}:${discountCents}`;
      } else {
        customId = `${PaymentIntent.CHECKOUT}:${userId}`;
      }
      break;
    }

    default:
      return undefined;
  }

  return customId.slice(0, MAX_CUSTOM_ID_LENGTH);
}

/**
 * Decode a custom ID string back into metadata
 */
export function decodeCustomId(customId: string): PaymentMetadata | null {
  const parts = customId.split(':');
  
  if (parts.length < 2) {
    return null;
  }

  const [intent, userId, ...rest] = parts;

  switch (intent) {
    case PaymentIntent.WALLET_RECHARGE:
      return {
        intent: PaymentIntent.WALLET_RECHARGE,
        userId,
        rechargeId: rest[0],
      };

    case PaymentIntent.CHECKOUT:
      if (rest.length >= 2) {
        return {
          intent: PaymentIntent.CHECKOUT,
          userId,
          phaseRewardType: rest[0] as 'free_product' | 'store_credit',
          phaseRewardDiscountCents: parseInt(rest[1], 10),
        };
      }
      return {
        intent: PaymentIntent.CHECKOUT,
        userId,
      };

    default:
      return null;
  }
}
