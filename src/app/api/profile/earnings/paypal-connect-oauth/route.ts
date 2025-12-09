import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { i18n } from '@/i18n/config';

/**
 * GET /api/profile/earnings/paypal-connect-oauth
 *
 * Genera el URL de OAuth de PayPal para que el usuario pueda conectar su cuenta.
 * Este endpoint devuelve la URL a la que el usuario debe ser redirigido para autorizar
 * la conexión de su cuenta de PayPal.
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

    // Obtener las credenciales de PayPal desde payment_gateways
    const { data: gateway, error: gatewayError } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'paypal')
      .eq('is_active', true)
      .single();

    if (gatewayError || !gateway) {
      // Si no hay gateway configurado, usar variables de entorno
      const paypalClientId = process.env.PAYPAL_CLIENT_ID;

      if (!paypalClientId) {
        return NextResponse.json(
          { error: 'PayPal is not configured. Please contact administrator.' },
          { status: 503 }
        );
      }

      // Generar el URL de OAuth de PayPal
      const redirectUri = `${req.nextUrl.origin}/api/profile/earnings/paypal-connect-callback`;
      const state = `${user.id}:${Date.now()}:${lang}`; // Estado para validar el callback (incluye idioma)

      // PayPal OAuth URL (sandbox o production)
      const baseUrl = process.env.PAYPAL_MODE === 'live'
        ? 'https://www.paypal.com'
        : 'https://www.sandbox.paypal.com';

      const oauthUrl = new URL(`${baseUrl}/connect`);
      oauthUrl.searchParams.set('flowEntry', 'static');
      oauthUrl.searchParams.set('client_id', paypalClientId);
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('scope', 'openid email');
      oauthUrl.searchParams.set('redirect_uri', redirectUri);
      oauthUrl.searchParams.set('state', state);

      return NextResponse.json({
        url: oauthUrl.toString(),
        state,
      });
    }

    // Usar credenciales del gateway
    const mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
    const paypalClientId = mode === 'test'
      ? gateway.credentials.testClientId
      : gateway.credentials.clientId;

    if (!paypalClientId) {
      return NextResponse.json(
        { error: 'PayPal client ID is not configured. Please contact administrator.' },
        { status: 503 }
      );
    }

    // Generar el URL de OAuth de PayPal
    const redirectUri = `${req.nextUrl.origin}/api/profile/earnings/paypal-connect-callback`;
    const state = `${user.id}:${Date.now()}:${lang}`; // Estado para validar el callback (incluye idioma)

    // PayPal OAuth URL (sandbox o production)
    const baseUrl = mode === 'production'
      ? 'https://www.paypal.com'
      : 'https://www.sandbox.paypal.com';

    const oauthUrl = new URL(`${baseUrl}/connect`);
    oauthUrl.searchParams.set('flowEntry', 'static');
    oauthUrl.searchParams.set('client_id', paypalClientId);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', 'openid email');
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('state', state);

    return NextResponse.json({
      url: oauthUrl.toString(),
      state,
    });
  } catch (error) {
    console.error('Error generating PayPal OAuth URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
