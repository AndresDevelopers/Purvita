import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { EnvironmentService } from '@/lib/config/environment';
import { generateInvoiceHTML } from '@/modules/invoices/utils/invoice-template';
import {
  FALLBACK_BRANDING,
  loadAppSettings,
  loadBranding,
  resolveAdminClient,
} from '@/modules/invoices/services/invoice-context-service';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { orderId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to verify user session:', userError);
      }
      return NextResponse.json({ error: 'Unable to verify session' }, { status: 401 });
    }

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const _env = EnvironmentService.getInstance();
    const adminClient = await resolveAdminClient(supabase);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          product_id,
          qty,
          price_cents,
          products(name, description)
        )
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Order query error:', orderError);
      }
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const items = order.items || [];

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, email, phone, address, city, state, postal_code, country')
      .eq('id', user.id)
      .single();

    if (profileError && process.env.NODE_ENV !== 'production') {
      console.error('Profile query error:', profileError);
    }

    const branding = await loadBranding(adminClient, supabase);
    const appSettings = await loadAppSettings(adminClient);

    const currency = (order.currency ?? appSettings?.currency ?? 'USD').toString().toUpperCase();

    const invoiceHTML = generateInvoiceHTML({
      order,
      items,
      profile,
      branding: branding ?? FALLBACK_BRANDING,
      currency,
      emptyItemsDescription: DEFAULT_EMPTY_DESCRIPTION,
    });

    return new NextResponse(invoiceHTML, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error generating invoice:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
    return NextResponse.json(
      {
        error: 'Failed to generate invoice',
        details: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

const DEFAULT_EMPTY_DESCRIPTION = 'This invoice corresponds to a subscription payment.';

