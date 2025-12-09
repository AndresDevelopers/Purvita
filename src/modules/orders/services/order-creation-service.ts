import type { SupabaseClient } from '@supabase/supabase-js';
import { CommissionCalculatorService } from '@/modules/multilevel/services/commission-calculator-service';
import { logUserAction } from '@/lib/services/audit-log-service';

interface CartItem {
  productId: string;
  productName?: string;
  quantity: number;
  priceCents: number;
}

interface OrderCreationParams {
  userId: string;
  totalCents: number;
  currency?: string;
  gateway: 'stripe' | 'paypal' | 'wallet';
  gatewayTransactionId?: string;
  metadata?: Record<string, unknown>;
  cartItems?: CartItem[];
  taxCents?: number;
  shippingCents?: number;
  discountCents?: number;
}

interface OrderCreationResult {
  orderId: string;
  commissionsCreated: number;
  affiliateId?: string;
}

export class OrderCreationService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Creates an order in the database from payment metadata
   * Includes support for affiliate tracking and commission calculation
   */
  async createOrderFromPayment(params: OrderCreationParams): Promise<OrderCreationResult> {
    const {
      userId,
      totalCents,
      currency = 'USD',
      gateway,
      gatewayTransactionId,
      metadata = {},
      cartItems = [],
      taxCents = 0,
      shippingCents = 0,
      discountCents = 0,
    } = params;

    console.log('[OrderCreationService] Creating order for user:', userId, {
      totalCents,
      gateway,
      cartItemsCount: cartItems.length,
      hasAffiliateId: !!metadata.affiliateId,
    });

    // Extract affiliate information from metadata
    const affiliateId = metadata.affiliateId as string | undefined;
    const affiliateReferralCode = metadata.affiliateReferralCode as string | undefined;
    const saleChannel = metadata.saleChannel as string | undefined;

    // ✅ CRITICAL SECURITY FIX: Validate affiliateId to prevent fraud
    if (affiliateId) {
      // VALIDATION 1: Prevent self-referral purchases
      if (affiliateId === userId) {
        console.error('[SECURITY] Self-referral purchase attempt detected', {
          userId,
          affiliateId,
          gateway,
          totalCents,
        });
        throw new Error('Self-referral purchases are not allowed');
      }

      // VALIDATION 2: Verify affiliate exists and get their referral code
      const { data: affiliate, error: affiliateError } = await this.client
        .from('profiles')
        .select('id, referral_code')
        .eq('id', affiliateId)
        .single();

      if (affiliateError || !affiliate) {
        console.error('[SECURITY] Invalid affiliate ID in order', {
          userId,
          affiliateId,
          error: affiliateError?.message,
        });
        throw new Error('Invalid affiliate ID');
      }

      // VALIDATION 3: Verify affiliate has active subscription
      const { data: subscription, error: subError } = await this.client
        .from('subscriptions')
        .select('status, waitlisted')
        .eq('user_id', affiliateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('[SECURITY] Error checking affiliate subscription', {
          affiliateId,
          error: subError.message,
        });
        throw new Error('Error validating affiliate subscription');
      }

      if (!subscription || subscription.status !== 'active' || subscription.waitlisted) {
        console.error('[SECURITY] Affiliate does not have active subscription', {
          affiliateId,
          status: subscription?.status,
          waitlisted: subscription?.waitlisted,
        });
        throw new Error('Affiliate does not have an active subscription');
      }

      // VALIDATION 4: If referralCode is provided, validate it matches
      if (affiliateReferralCode && affiliate.referral_code !== affiliateReferralCode) {
        console.error('[SECURITY] Affiliate ID does not match referral code', {
          affiliateId,
          providedCode: affiliateReferralCode,
          actualCode: affiliate.referral_code,
        });
        throw new Error('Affiliate ID mismatch');
      }

      console.log('[OrderCreationService] Validated affiliate', {
        affiliateId,
        referralCode: affiliate.referral_code,
        hasActiveSubscription: true,
      });
    }

    // Determine purchase source based on affiliate information
    const purchaseSource = affiliateId || saleChannel === 'affiliate_store' ? 'affiliate_store' : 'main_store';

    // Prepare order metadata
    const orderMetadata: Record<string, unknown> = {
      ...metadata,
      gateway,
      ...(gatewayTransactionId && { gateway_transaction_id: gatewayTransactionId }),
      ...(affiliateId && {
        affiliate_id: affiliateId,
        affiliate_referral_code: affiliateReferralCode,
        sale_channel: saleChannel || 'affiliate_store',
      }),
      created_from: 'payment_webhook',
      timestamp: new Date().toISOString(),
    };

    // Create the order
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .insert({
        user_id: userId,
        status: 'paid',
        total_cents: totalCents,
        tax_cents: taxCents,
        shipping_cents: shippingCents,
        discount_cents: discountCents,
        currency,
        gateway,
        gateway_transaction_id: gatewayTransactionId || null,
        purchase_source: purchaseSource,
        metadata: orderMetadata,
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('[OrderCreationService] Failed to create order:', orderError);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    const orderId = order.id;
    console.log('[OrderCreationService] Order created successfully:', orderId);

    // Log audit trail for paid order
    try {
      const productNames = cartItems.map(item => item.productName).filter(Boolean).join(', ');
      await logUserAction('ORDER_PAID', 'order', orderId, {
        totalCents,
        currency,
        gateway,
        itemsCount: cartItems.length,
        productNames: productNames || 'N/A',
        affiliateId,
      });
    } catch (auditError) {
      console.warn('[OrderCreationService] Failed to log paid order audit:', auditError);
    }

    // Create order items if cart items are provided
    if (cartItems.length > 0) {
      console.log('[OrderCreationService] Creating order items:', cartItems.length);

      const orderItemsData = cartItems.map(item => ({
        order_id: orderId,
        product_id: item.productId,
        qty: item.quantity,
        price_cents: item.priceCents,
      }));

      const { error: itemsError } = await this.client
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) {
        console.error('[OrderCreationService] Failed to create order items:', itemsError);
        // Don't fail the whole transaction, just log the error
      } else {
        console.log('[OrderCreationService] Order items created successfully');
      }
    }

    // Calculate and create network commissions
    let commissionsCreated = 0;
    try {
      const commissionService = new CommissionCalculatorService(this.client);
      const commissions = await commissionService.calculateAndCreateCommissions(
        userId,
        totalCents,
        {
          orderId,
          orderMetadata,
        }
      );
      commissionsCreated = commissions.length;
      console.log('[OrderCreationService] Created commissions:', commissionsCreated);
    } catch (commError) {
      console.error('[OrderCreationService] Failed to create commissions:', commError);
      // Don't fail the order creation if commissions fail
    }

    return {
      orderId,
      commissionsCreated,
      affiliateId,
    };
  }

  /**
   * Checks if an order already exists for a given gateway transaction ID
   * to prevent duplicate order creation
   */
  async orderExistsForTransaction(gatewayTransactionId: string): Promise<boolean> {
    if (!gatewayTransactionId) {
      return false;
    }

    const { data, error } = await this.client
      .from('orders')
      .select('id')
      .eq('gateway_transaction_id', gatewayTransactionId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[OrderCreationService] Error checking for existing order:', error);
      return false;
    }

    return !!data;
  }
}

