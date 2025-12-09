import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { i18n } from '@/i18n/config';

/**
 * GET /api/profile/earnings/stripe-connect-callback
 *
 * Callback de OAuth de Stripe Connect. Stripe redirige aquí después de que el usuario
 * autoriza la conexión. Este endpoint intercambia el código de autorización por
 * un account_id de Stripe Connect y lo guarda en la base de datos.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = req.nextUrl;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Extraer el idioma del state o usar el idioma por defecto
    const stateValue = state || '';
    const stateParts = stateValue.split(':');
    const userId = stateParts[0];
    const lang = stateParts[2] || i18n.defaultLocale; // userId:timestamp:lang

    // Si el usuario rechazó la autorización
    if (error) {
      const errorMessage = errorDescription || error;
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=${encodeURIComponent(errorMessage)}`, req.nextUrl.origin)
      );
    }

    // Validar parámetros
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Invalid+callback+parameters`, req.nextUrl.origin)
      );
    }

    // Validar userId del state
    if (!userId) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Invalid+state+parameter`, req.nextUrl.origin)
      );
    }

    // Verificar que el usuario autenticado coincida con el userId del state
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Unauthorized`, req.nextUrl.origin)
      );
    }

    // Obtener las credenciales de Stripe
    const { data: gateway, error: gatewayError } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'stripe')
      .eq('is_active', true)
      .single();

    let stripeSecretKey: string;

    if (gatewayError || !gateway) {
      // Usar variable de entorno
      stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
    } else {
      const mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
      stripeSecretKey = mode === 'test'
        ? gateway.credentials.testSecret || ''
        : gateway.credentials.secret || '';
    }

    if (!stripeSecretKey) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Stripe+not+configured`, req.nextUrl.origin)
      );
    }

    // Intercambiar el código por un access token
    const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      // Only log detailed errors in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('Stripe OAuth token error:', errorData);
      } else {
        console.error('Stripe OAuth token error: Failed to exchange authorization code');
      }
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Failed+to+connect+Stripe+account`, req.nextUrl.origin)
      );
    }

    const tokenData = await tokenResponse.json();
    const stripeAccountId = tokenData.stripe_user_id;

    if (!stripeAccountId) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Invalid+Stripe+response`, req.nextUrl.origin)
      );
    }

    // Guardar la cuenta en la base de datos
    const { error: upsertError } = await supabase
      .from('payout_accounts')
      .upsert({
        user_id: userId,
        provider: 'stripe',
        account_id: stripeAccountId,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      // Only log detailed errors in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error saving payout account:', upsertError);
      } else {
        console.error('Error saving payout account');
      }
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Failed+to+save+account`, req.nextUrl.origin)
      );
    }

    // Redirigir de vuelta a payout-settings con éxito
    return NextResponse.redirect(
      new URL(`/${lang}/profile/payout-settings?success=stripe_connected`, req.nextUrl.origin)
    );
  } catch (error) {
    // Only log detailed errors in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error in Stripe Connect callback:', error);
    } else {
      console.error('Error in Stripe Connect callback');
    }
    return NextResponse.redirect(
      new URL(`/${i18n.defaultLocale}/profile/payout-settings?error=Internal+server+error`, req.nextUrl.origin)
    );
  }
}
