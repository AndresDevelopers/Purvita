import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSubscriptionInvoiceModule } from '@/modules/subscription/invoices/factories/subscription-invoice-service-factory';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limitParam = request.nextUrl.searchParams.get('limit');
    const includeArchivedParam = request.nextUrl.searchParams.get('includeArchived');

    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0 ? parsedLimit : undefined;
    const includeArchived = includeArchivedParam !== 'false';

    const { service } = createSubscriptionInvoiceModule(supabase);
    const invoices = await service.listInvoices(user.id, { limit, includeArchived });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('[subscription-invoices] Failed to load invoices', error);
    const message = error instanceof Error ? error.message : 'Failed to load invoices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
