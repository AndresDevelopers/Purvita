import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInvoiceHTML } from '@/modules/invoices/utils/invoice-template';
import {
  FALLBACK_BRANDING,
  loadAppSettings,
  loadBranding,
  resolveAdminClient,
} from '@/modules/invoices/services/invoice-context-service';
import { createSubscriptionInvoiceModule } from '@/modules/subscription/invoices/factories/subscription-invoice-service-factory';

interface RouteContext {
  params: Promise<{ invoiceId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { invoiceId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { service } = createSubscriptionInvoiceModule(supabase);
    const invoice = await service.getInvoice(user.id, invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, email, phone, address, city, state, postal_code, country')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[subscription-invoices] Failed to load billing profile', profileError);
    }

    const adminClient = await resolveAdminClient(supabase);
    const branding = await loadBranding(adminClient, supabase);
    const appSettings = await loadAppSettings(adminClient);

    const currency = (invoice.currency ?? appSettings?.currency ?? 'USD').toString().toUpperCase();

    const pseudoOrder = {
      id: invoice.id,
      created_at: invoice.created_at,
      status: invoice.status,
      total_cents: invoice.amount_cents,
      tax_cents: 0,
      shipping_cents: 0,
      discount_cents: 0,
      gateway: invoice.gateway,
      gateway_transaction_id: invoice.gateway_ref,
    };

    const periodEnd = invoice.period_end ? new Date(invoice.period_end) : null;
    const formattedPeriodEnd = periodEnd
      ? new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(periodEnd)
      : null;

    const emptyItemsDescription = formattedPeriodEnd
      ? `This invoice covers your subscription through ${formattedPeriodEnd}.`
      : 'This invoice corresponds to your subscription activation.';

    const invoiceHTML = generateInvoiceHTML({
      order: pseudoOrder,
      items: [],
      profile: profile ?? {},
      branding: branding ?? FALLBACK_BRANDING,
      currency,
      emptyItemsDescription,
    });

    return new NextResponse(invoiceHTML, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('[subscription-invoices] Failed to render invoice', error);
    const message = error instanceof Error ? error.message : 'Failed to render invoice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
