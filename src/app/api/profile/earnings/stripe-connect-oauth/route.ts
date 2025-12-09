import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { i18n } from '@/i18n/config';

/**
 * GET /api/profile/earnings/stripe-connect-oauth
 *
 * Genera el URL de OAuth de Stripe Connect para que el usuario pueda conectar su cuenta.
 * Este endpoint devuelve la URL a la que el usuario debe ser redirigido para autorizar
 * la conexión de su cuenta de Stripe.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el idioma del parámetro de consulta o usar el idioma por defecto
    const lang = req.nextUrl.searchParams.get('lang') || i18n.defaultLocale;

    // Obtener las credenciales de Stripe desde payment_gateways
    const { data: gateway, error: gatewayError } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'stripe')
      .eq('is_active', true)
      .single();

    if (gatewayError || !gateway) {
      // Si no hay gateway configurado, usar variables de entorno
      // Intentar primero con test, luego con producción
      const stripeClientId = process.env.STRIPE_TEST_CONNECT_CLIENT_ID || process.env.STRIPE_CONNECT_CLIENT_ID;

      if (!stripeClientId) {
        return NextResponse.json(
          { error: 'Stripe Connect is not configured. Please contact administrator.' },
          { status: 503 }
        );
      }

      // Generar el URL de OAuth de Stripe Connect
      const redirectUri = `${req.nextUrl.origin}/api/profile/earnings/stripe-connect-callback`;
      const state = `${user.id}:${Date.now()}:${lang}`; // Estado para validar el callback (incluye idioma)

      const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
      oauthUrl.searchParams.set('client_id', stripeClientId);
      oauthUrl.searchParams.set('state', state);
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('redirect_uri', redirectUri);
      oauthUrl.searchParams.set('scope', 'read_write');

      return NextResponse.json({
        url: oauthUrl.toString(),
        state,
      });
    }

    // Usar credenciales del gateway
    const mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
    // Intentar usar connectClientId primero, luego publishableKey como fallback
    const stripeClientId = mode === 'test'
      ? (gateway.credentials.testConnectClientId || gateway.credentials.testPublishableKey)
      : (gateway.credentials.connectClientId || gateway.credentials.publishableKey);

    if (!stripeClientId) {
      return NextResponse.json(
        { error: 'Stripe Connect client ID is not configured. Please contact administrator.' },
        { status: 503 }
      );
    }

    // Generar el URL de OAuth de Stripe Connect
    const redirectUri = `${req.nextUrl.origin}/api/profile/earnings/stripe-connect-callback`;
    const state = `${user.id}:${Date.now()}:${lang}`; // Estado para validar el callback (incluye idioma)

    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    oauthUrl.searchParams.set('client_id', stripeClientId);
    oauthUrl.searchParams.set('state', state);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('scope', 'read_write');

    return NextResponse.json({
      url: oauthUrl.toString(),
      state,
    });
  } catch (error) {
    console.error('Error generating Stripe Connect OAuth URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
