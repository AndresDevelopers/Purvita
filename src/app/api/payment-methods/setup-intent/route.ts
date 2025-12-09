import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentMethodService } from '@/modules/payment-methods/services/payment-method-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/payment-methods/setup-intent
 * Create a Stripe SetupIntent for adding a new card
 */
export async function POST(_req: NextRequest) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(_req);
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

    const service = new PaymentMethodService(supabase);
    const { clientSecret } = await service.createSetupIntent(user.id);

    return NextResponse.json({ clientSecret });
  } catch (error) {
    console.error('Failed to create setup intent:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    const message = error instanceof Error ? error.message : 'Failed to create setup intent';
    return NextResponse.json({ error: message, details: error }, { status: 500 });
  }
}
