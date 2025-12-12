/**
 * Payment Validation Service
 * 
 * Provides server-side validation for payment amounts and metadata
 * to prevent price manipulation attacks.
 * 
 * SECURITY: Never trust client-provided prices. Always validate against
 * server-side pricing configuration or database.
 */

import { z } from 'zod';

/**
 * Allowed metadata keys for payments
 * Whitelist approach: only these keys are allowed in payment metadata
 */
export const ALLOWED_METADATA_KEYS = new Set([
  // Order-related
  'orderId',
  'order_id',
  'orderNumber',

  // User-related
  'userId',
  'user_id',
  'customerId',
  'customer_id',

  // Product-related
  'productId',
  'product_id',
  'productName',
  'product_name',
  'sku',

  // Subscription-related
  'subscriptionId',
  'subscription_id',
  'planId',
  'plan_id',

  // Wallet-related
  'rechargeId',
  'recharge_id',
  'walletUserId',
  'wallet_user_id',

  // Payment intent
  'intent',
  'paymentIntent',
  'payment_intent',

  // Discount/Reward
  'rewardType',
  'reward_type',
  'discountCents',
  'discount_cents',
  'couponCode',
  'coupon_code',

  // Referral/MLM
  'referrerId',
  'referrer_id',
  'sponsorId',
  'sponsor_id',
  'affiliateReferralCode',
  'affiliateId',
  'saleChannel',

  // Authorize.net specific (SECURITY WARNING: These contain sensitive card data)
  // TODO: Replace with tokenization (Accept.js) for PCI compliance
  'cardNumber',
  'expirationDate',
  'cvv',
  'firstName',
  'lastName',
  'address',
  'city',
  'state',
  'zip',
  'country',
  'customerEmail',

  // Payoneer specific (for payouts)
  'payeeId',
  'payeeEmail',

  // Cart items
  'cartItems',

  // Misc
  'description',
  'notes',
  'source',
  'campaign',
]);

/**
 * Sanitize payment metadata by removing disallowed keys
 * 
 * @param metadata - Raw metadata object from client
 * @returns Sanitized metadata with only allowed keys
 */
export function sanitizePaymentMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  // SQL injection patterns to remove
  const sqlPatterns = [
    /DROP\s+TABLE/gi,
    /DELETE\s+FROM/gi,
    /INSERT\s+INTO/gi,
    /UPDATE\s+SET/gi,
    /SELECT\s+FROM/gi,
    /UNION\s+SELECT/gi,
    /--/g, // SQL comments
    /;/g,  // Statement terminators
    /\/\*/g, // Block comment start
    /\*\//g, // Block comment end
  ];

  // Fields that should be preserved as-is (payment card data)
  // SECURITY NOTE: These are only allowed because they're sent directly to payment gateway
  // and never stored in our database
  const preserveAsIsFields = new Set([
    'cardNumber',
    'expirationDate',
    'cvv',
  ]);

  for (const [key, value] of Object.entries(metadata)) {
    // Only include allowed keys
    if (ALLOWED_METADATA_KEYS.has(key)) {
      // Special handling for sensitive payment fields
      if (preserveAsIsFields.has(key) && typeof value === 'string') {
        // Only allow digits, spaces, and slashes for card data
        const cleaned = value.replace(/[^0-9\s/]/g, '').trim();
        sanitized[key] = cleaned;
        continue;
      }

      // Sanitize value (prevent XSS, SQL injection, etc.)
      if (typeof value === 'string') {
        let sanitizedValue = value;

        // Remove SQL injection patterns
        for (const pattern of sqlPatterns) {
          sanitizedValue = sanitizedValue.replace(pattern, '');
        }

        // Remove potentially dangerous characters
        sanitizedValue = sanitizedValue
          .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/[^\w\s@.\-_:]/g, '') // Allow only safe characters
          .trim()
          .slice(0, 500); // Limit length

        sanitized[key] = sanitizedValue;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null) {
        sanitized[key] = null;
      }
      // Skip objects, arrays, and other complex types
    }
  }

  return sanitized;
}

/**
 * Payment intent types
 */
export type PaymentIntent =
  | 'checkout'
  | 'subscription'
  | 'wallet_recharge'
  | 'donation'
  | 'upgrade';

/**
 * Validate payment intent and extract required metadata
 */
export function validatePaymentIntent(
  intent: string | undefined,
  metadata: Record<string, unknown>
): { valid: boolean; error?: string } {
  if (!intent) {
    return { valid: false, error: 'Payment intent is required' };
  }

  const validIntents: PaymentIntent[] = [
    'checkout',
    'subscription',
    'wallet_recharge',
    'donation',
    'upgrade',
  ];

  if (!validIntents.includes(intent as PaymentIntent)) {
    return { valid: false, error: `Invalid payment intent: ${intent}` };
  }

  // Validate required metadata based on intent
  switch (intent as PaymentIntent) {
    case 'checkout':
      // orderId is optional for checkout - it will be created by the server
      // We just need to ensure the intent is set correctly
      break;

    case 'subscription':
      if (!metadata.subscriptionId && !metadata.subscription_id) {
        return { valid: false, error: 'subscriptionId is required for subscription payments' };
      }
      break;

    case 'wallet_recharge': {
      const missingFields: string[] = [];
      if (!metadata.rechargeId && !metadata.recharge_id) {
        missingFields.push('rechargeId');
      }
      if (!metadata.userId && !metadata.user_id) {
        missingFields.push('userId');
      }
      if (missingFields.length > 0) {
        return {
          valid: false,
          error: `${missingFields.join(' and ')} ${missingFields.length === 1 ? 'is' : 'are'} required for wallet recharge`
        };
      }
      break;
    }

    case 'donation':
      // No required metadata for donations
      break;

    case 'upgrade':
      if (!metadata.userId && !metadata.user_id) {
        return { valid: false, error: 'userId is required for upgrade payments' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Server-side price validation schema
 * 
 * This should be extended with actual product pricing from database
 * For now, we validate basic constraints
 */
export const PriceValidationSchema = z.object({
  amountCents: z.number()
    .int('Amount must be an integer')
    .positive('Amount must be positive')
    .min(50, 'Minimum amount is $0.50 (50 cents)')
    .max(10000000, 'Maximum amount is $100,000 (10,000,000 cents)'),

  currency: z.string()
    .length(3, 'Currency must be 3-letter ISO code')
    .toUpperCase()
    .refine(
      (val) => ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(val),
      { message: 'Unsupported currency' }
    ),

  intent: z.enum(['checkout', 'subscription', 'wallet_recharge', 'donation', 'upgrade']),
});

/**
 * Validate payment amount against server-side pricing
 *
 * @param amountCents - Amount in cents from client
 * @param currency - Currency code
 * @param intent - Payment intent
 * @param metadata - Payment metadata
 * @returns Validation result
 */
export async function validatePaymentAmount(
  amountCents: number,
  currency: string,
  intent: PaymentIntent,
  metadata: Record<string, unknown>
): Promise<{ valid: boolean; error?: string; serverAmountCents?: number }> {
  // Validate basic constraints
  const validation = PriceValidationSchema.safeParse({
    amountCents,
    currency: currency.toUpperCase(),
    intent,
  });

  if (!validation.success) {
    return {
      valid: false,
      error: validation.error.issues[0]?.message || 'Invalid payment amount',
    };
  }

  // For wallet recharge, allow any amount within limits
  if (intent === 'wallet_recharge') {
    return { valid: true, serverAmountCents: amountCents };
  }

  // For donations, allow any amount within limits
  if (intent === 'donation') {
    return { valid: true, serverAmountCents: amountCents };
  }

  // For checkout: Validate product pricing if productId is present
  if (intent === 'checkout' && (metadata.productId || metadata.product_id)) {
    const productId = (metadata.productId || metadata.product_id) as string;

    try {
      // Import Supabase client
      const { createAdminClient } = await import('@/lib/supabase/server');
      const supabase = createAdminClient();

      // Query product price from database
      const { data: product, error } = await supabase
        .from('products')
        .select('price_cents, currency, status')
        .eq('id', productId)
        .single();

      if (error || !product) {
        return {
          valid: false,
          error: 'Product not found or unavailable',
        };
      }

      // Check if product is active
      if (product.status !== 'active') {
        return {
          valid: false,
          error: 'Product is not available for purchase',
        };
      }

      // Validate currency matches
      if (product.currency && product.currency.toUpperCase() !== currency.toUpperCase()) {
        return {
          valid: false,
          error: `Currency mismatch: product is priced in ${product.currency}`,
        };
      }

      // Validate price matches (prevent price manipulation)
      if (product.price_cents !== amountCents) {
        console.warn(`[Payment Validation] Price mismatch detected for product ${productId}: client=${amountCents}, server=${product.price_cents}`);
        return {
          valid: false,
          error: 'Price mismatch detected. Please refresh and try again.',
          serverAmountCents: product.price_cents,
        };
      }

      return { valid: true, serverAmountCents: product.price_cents };
    } catch (error) {
      console.error('[Payment Validation] Error validating product price:', error);
      // On database error, reject for security
      return {
        valid: false,
        error: 'Unable to validate product price. Please try again.',
      };
    }
  }

  // For subscription: Validate against subscription plans
  if (intent === 'subscription' && (metadata.planId || metadata.plan_id)) {
    const planId = (metadata.planId || metadata.plan_id) as string;

    try {
      const { createAdminClient } = await import('@/lib/supabase/server');
      const supabase = createAdminClient();

      const { data: plan, error } = await supabase
        .from('subscription_plans')
        .select('price_cents, currency, status')
        .eq('id', planId)
        .single();

      if (error || !plan) {
        return {
          valid: false,
          error: 'Subscription plan not found',
        };
      }

      if (plan.status !== 'active') {
        return {
          valid: false,
          error: 'Subscription plan is not available',
        };
      }

      if (plan.currency && plan.currency.toUpperCase() !== currency.toUpperCase()) {
        return {
          valid: false,
          error: `Currency mismatch: plan is priced in ${plan.currency}`,
        };
      }

      if (plan.price_cents !== amountCents) {
        console.warn(`[Payment Validation] Price mismatch for plan ${planId}: client=${amountCents}, server=${plan.price_cents}`);
        return {
          valid: false,
          error: 'Price mismatch detected. Please refresh and try again.',
          serverAmountCents: plan.price_cents,
        };
      }

      return { valid: true, serverAmountCents: plan.price_cents };
    } catch (error) {
      console.error('[Payment Validation] Error validating plan price:', error);
      return {
        valid: false,
        error: 'Unable to validate subscription price. Please try again.',
      };
    }
  }

  // For upgrade and other intents without specific product validation
  // Still validate amount is within acceptable range
  return { valid: true, serverAmountCents: amountCents };
}

/**
 * Comprehensive payment validation
 * 
 * Validates both metadata and amount
 */
export async function validatePayment(params: {
  amountCents: number;
  currency: string;
  intent: string;
  metadata: Record<string, unknown> | null | undefined;
}): Promise<{
  valid: boolean;
  error?: string;
  sanitizedMetadata: Record<string, unknown>;
  serverAmountCents?: number;
}> {
  const { amountCents, currency, intent, metadata } = params;

  // Sanitize metadata first
  const sanitizedMetadata = sanitizePaymentMetadata(metadata);

  // Validate intent
  const intentValidation = validatePaymentIntent(intent, sanitizedMetadata);
  if (!intentValidation.valid) {
    return {
      valid: false,
      error: intentValidation.error,
      sanitizedMetadata,
    };
  }

  // Validate amount
  const amountValidation = await validatePaymentAmount(
    amountCents,
    currency,
    intent as PaymentIntent,
    sanitizedMetadata
  );

  if (!amountValidation.valid) {
    return {
      valid: false,
      error: amountValidation.error,
      sanitizedMetadata,
      serverAmountCents: amountValidation.serverAmountCents,
    };
  }

  return {
    valid: true,
    sanitizedMetadata,
    serverAmountCents: amountValidation.serverAmountCents,
  };
}

