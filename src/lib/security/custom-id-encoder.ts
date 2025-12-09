/**
 * Custom ID Encoder for PayPal transactions
 *
 * This module provides secure encoding/decoding of custom IDs for PayPal transactions.
 * Instead of exposing sensitive data like user IDs and discount amounts directly,
 * we create hashed tokens and store the mapping in Redis with TTL.
 *
 * Security benefits:
 * - Hides sensitive information from PayPal logs
 * - Prevents enumeration attacks
 * - Time-limited tokens (expire after 24 hours)
 */

import { createHmac, randomBytes } from 'crypto';
import { redisCache } from '@/lib/redis';

const CUSTOM_ID_PREFIX = 'paypal_custom';
const CUSTOM_ID_TTL = 86400; // 24 hours in seconds

/**
 * Generate a secure custom ID for PayPal transactions
 */
export async function encodeCustomId(data: {
  userId: string;
  intent: 'checkout' | 'subscription' | 'wallet_recharge';
  rewardType?: string;
  discountCents?: number;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  // Generate a random token
  const token = randomBytes(16).toString('hex');

  // Create HMAC signature for integrity verification
  const signature = createHmac('sha256', getCustomIdSecret())
    .update(JSON.stringify({ token, ...data }))
    .digest('hex')
    .substring(0, 8); // Use first 8 chars

  // Combine token with signature
  const customId = `${data.intent}_${token}_${signature}`;

  // Store mapping in Redis with TTL
  const cacheKey = `${CUSTOM_ID_PREFIX}:${customId}`;
  await redisCache.set(cacheKey, JSON.stringify(data), CUSTOM_ID_TTL);

  return customId;
}

/**
 * Decode a custom ID and retrieve the original data
 */
export async function decodeCustomId(customId: string): Promise<{
  userId: string;
  intent: 'checkout' | 'subscription' | 'wallet_recharge';
  rewardType?: string;
  discountCents?: number;
  metadata?: Record<string, unknown>;
} | null> {
  if (!customId) {
    return null;
  }

  const cacheKey = `${CUSTOM_ID_PREFIX}:${customId}`;
  const dataStr = await redisCache.get<string>(cacheKey);

  if (!dataStr) {
    console.warn(`[CustomIdEncoder] Custom ID not found or expired: ${customId}`);
    return null;
  }

  try {
    const data = JSON.parse(dataStr);

    // Verify signature
    const [_intent, token, providedSignature] = customId.split('_');
    const expectedSignature = createHmac('sha256', getCustomIdSecret())
      .update(JSON.stringify({ token, ...data }))
      .digest('hex')
      .substring(0, 8);

    if (providedSignature !== expectedSignature) {
      console.error(`[CustomIdEncoder] Invalid signature for custom ID: ${customId}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`[CustomIdEncoder] Failed to decode custom ID:`, error);
    return null;
  }
}

/**
 * Fallback decoder for legacy format (backwards compatibility)
 * This supports the old format: "intent:userId:rewardType:discountCents"
 */
export function decodeLegacyCustomId(customId: string): {
  userId: string;
  intent: string;
  rewardType?: string;
  discountCents?: number;
} | null {
  if (!customId) {
    return null;
  }

  // Check if it's a legacy format (contains colons)
  if (!customId.includes(':')) {
    return null;
  }

  const parts = customId.split(':');

  // Wallet recharge format: "wallet_recharge:userId"
  if (parts[0] === 'wallet_recharge' && parts.length >= 2) {
    return {
      intent: 'wallet_recharge',
      userId: parts[1],
    };
  }

  // Subscription format: "subscription:userId"
  if (parts[0] === 'subscription' && parts.length >= 2) {
    return {
      intent: 'subscription',
      userId: parts[1],
    };
  }

  // Checkout format: "checkout:userId:rewardType:discountCents"
  if (parts[0] === 'checkout' && parts.length >= 2) {
    return {
      intent: 'checkout',
      userId: parts[1],
      rewardType: parts.length >= 3 ? parts[2] : undefined,
      discountCents: parts.length >= 4 ? parseInt(parts[3], 10) : undefined,
    };
  }

  return null;
}

/**
 * Unified decoder that tries new format first, then falls back to legacy
 */
export async function decodeCustomIdWithFallback(customId: string) {
  // Try new secure format first
  const decoded = await decodeCustomId(customId);
  if (decoded) {
    return decoded;
  }

  // Fall back to legacy format for backwards compatibility
  return decodeLegacyCustomId(customId);
}

/**
 * Get the secret key for HMAC signing
 */
function getCustomIdSecret(): string {
  const secret = process.env.CUSTOM_ID_SECRET;
  if (!secret) {
    throw new Error('CUSTOM_ID_SECRET environment variable is required');
  }
  return secret;
}

/**
 * Delete a custom ID from cache (cleanup after use)
 */
export async function deleteCustomId(customId: string): Promise<void> {
  const cacheKey = `${CUSTOM_ID_PREFIX}:${customId}`;
  await redisCache.delete(cacheKey);
}
