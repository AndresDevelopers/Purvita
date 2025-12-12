import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createSubscriptionInvoiceModule } from '@/modules/subscription/invoices/factories/subscription-invoice-service-factory';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const UnarchiveInvoicesSchema = z.object({
  invoiceIds: z.array(z.string()).min(1, 'At least one invoice ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const { invoiceIds } = UnarchiveInvoicesSchema.parse(payload);

    const { service } = createSubscriptionInvoiceModule(supabase);
    await service.unarchiveInvoices(user.id, invoiceIds);

    return NextResponse.json({
      success: true,
      message: `Unarchived ${invoiceIds.length} invoice${invoiceIds.length > 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error('[subscription-invoices] Failed to unarchive invoices', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Failed to unarchive invoices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
