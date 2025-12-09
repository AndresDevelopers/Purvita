import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentMethodService } from '@/modules/payment-methods/services/payment-method-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * DELETE /api/payment-methods/[id]
 * Remove a payment method
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(req);
    if (csrfError) {
      return csrfError;
    }

    const { id } = await context.params;
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new PaymentMethodService(supabase);
    await service.removePaymentMethod(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to remove payment method:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to remove payment method';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * PATCH /api/payment-methods/[id]
 * Set payment method as default
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(req);
    if (csrfError) {
      return csrfError;
    }

    const { id } = await context.params;
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new PaymentMethodService(supabase);
    const paymentMethod = await service.setDefaultPaymentMethod(id, user.id);

    return NextResponse.json({ paymentMethod });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to set default payment method:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to set default payment method';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
