import { NextRequest, NextResponse } from 'next/server';
import { PhaseRewardsService } from '@/lib/services/phase-rewards-service';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { z } from 'zod';
import { createSecurityModule } from '@/modules/security/factories/security-module';

const { rateLimitService } = createSecurityModule();

/**
 * Apply phase rewards (free product or store credit) to an order
 * This should be called after payment is confirmed
 */

const ApplyRewardsSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  rewardType: z.enum(['free_product', 'store_credit'], {
    errorMap: () => ({ message: 'Invalid reward type. Must be "free_product" or "store_credit"' })
  }),
});

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting to prevent abuse of reward application
    const guard = await rateLimitService.guard(request, 'api:orders:apply-rewards:post');
    if (!guard.result.allowed) {
      const response = NextResponse.json(
        rateLimitService.buildErrorPayload(guard.locale),
        { status: 429 }
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }

    // ✅ SECURITY: Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    // ✅ SECURITY: Use proper Supabase authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // ✅ SECURITY: Validate request body with Zod
    const body = await request.json();
    const { orderId, rewardType } = ApplyRewardsSchema.parse(body);

    // ✅ SECURITY: Fetch order from database and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, total_cents, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // ✅ SECURITY: Verify order belongs to authenticated user
    if (order.user_id !== userId) {
      console.warn('[Apply Rewards] User attempted to apply reward to another user\'s order', {
        userId,
        orderId,
        orderUserId: order.user_id
      });

      return NextResponse.json(
        { error: 'Unauthorized: Order does not belong to this user' },
        { status: 403 }
      );
    }

    // Check if order is in valid state for applying rewards
    if (order.status !== 'pending' && order.status !== 'processing') {
      return NextResponse.json(
        { error: 'Rewards can only be applied to pending or processing orders' },
        { status: 400 }
      );
    }

    // ✅ CRITICAL SECURITY FIX: Calculate discount on SERVER, never trust client
    // Previous version accepted discountCents from client - security vulnerability
    const { discountCents, rewardType: calculatedRewardType } = await PhaseRewardsService.calculateDiscount(
      userId,
      order.total_cents
    );

    if (discountCents === 0 || calculatedRewardType === null) {
      return NextResponse.json(
        { error: 'No rewards available to apply' },
        { status: 400 }
      );
    }

    // Verify the calculated reward type matches what user requested
    if (calculatedRewardType !== rewardType) {
      return NextResponse.json(
        {
          error: `Reward type mismatch. Expected "${calculatedRewardType}" but got "${rewardType}"`,
          availableRewardType: calculatedRewardType
        },
        { status: 400 }
      );
    }

    // Apply the SERVER-CALCULATED discount
    const result = await PhaseRewardsService.applyReward(userId, discountCents, rewardType);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to apply reward' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      rewardType: result.rewardType,
      discountAppliedCents: result.discountAppliedCents,
      remainingCreditCents: result.remainingCreditCents,
    });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: error.errors[0].message
        },
        { status: 400 }
      );
    }

    console.error('[Apply Rewards] Unexpected error:', error);
    // ✅ SECURITY: Sanitize error message in production
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Internal server error');

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
