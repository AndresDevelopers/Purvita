import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentMethodService } from '@/modules/payment-methods/services/payment-method-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * GET /api/payment-methods
 * Get user's saved payment methods
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new PaymentMethodService(supabase);
    const paymentMethods = await service.getUserPaymentMethods(user.id);

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error('Failed to fetch payment methods:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment methods';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/payment-methods
 * Add a new payment method
 * Body: { paymentMethodId: string, setAsDefault?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(req);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { paymentMethodId, setAsDefault = false } = body;

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    const service = new PaymentMethodService(supabase);
    const paymentMethod = await service.addPaymentMethod(user.id, paymentMethodId, setAsDefault);

    return NextResponse.json({ paymentMethod });
  } catch (error) {
    console.error('Failed to add payment method:', error);
    const message = error instanceof Error ? error.message : 'Failed to add payment method';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
