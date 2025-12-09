import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { i18n } from '@/i18n/config';

/**
 * GET /api/profile/earnings/paypal-connect-callback
 *
 * Callback de OAuth de PayPal. PayPal redirige aquí después de que el usuario
 * autoriza la conexión. Este endpoint intercambia el código de autorización por
 * un access token y obtiene el email del usuario para guardarlo en la base de datos.
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

    // Obtener las credenciales de PayPal
    const { data: gateway, error: gatewayError } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('provider', 'paypal')
      .eq('is_active', true)
      .single();

    let paypalClientId: string;
    let paypalSecret: string;
    let paypalMode: 'test' | 'production';

    if (gatewayError || !gateway) {
      // Usar variables de entorno
      paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
      paypalSecret = process.env.PAYPAL_CLIENT_SECRET || '';
      paypalMode = (process.env.PAYPAL_MODE === 'live' ? 'production' : 'test') as 'test' | 'production';
    } else {
      const mode = gateway.credentials.mode === 'test' ? 'test' : 'production';
      paypalMode = mode;
      paypalClientId = mode === 'test'
        ? gateway.credentials.testClientId || ''
        : gateway.credentials.clientId || '';
      paypalSecret = mode === 'test'
        ? gateway.credentials.testSecret || ''
        : gateway.credentials.secret || '';
    }

    if (!paypalClientId || !paypalSecret) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=PayPal+not+configured`, req.nextUrl.origin)
      );
    }

    // PayPal API URL (sandbox o production)
    const apiBaseUrl = paypalMode === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    const redirectUri = `${req.nextUrl.origin}/api/profile/earnings/paypal-connect-callback`;

    // Intercambiar el código por un access token
    const tokenResponse = await fetch(`${apiBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      // Only log detailed errors in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('PayPal OAuth token error:', errorData);
      } else {
        console.error('PayPal OAuth token error: Failed to exchange authorization code');
      }
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Failed+to+connect+PayPal+account`, req.nextUrl.origin)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Invalid+PayPal+response`, req.nextUrl.origin)
      );
    }

    // Obtener información del usuario (email)
    const userInfoResponse = await fetch(`${apiBaseUrl}/v1/identity/oauth2/userinfo?schema=openid`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json().catch(() => ({}));
      // Only log detailed errors in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('PayPal userinfo error:', errorData);
      } else {
        console.error('PayPal userinfo error: Failed to get user information');
      }
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=Failed+to+get+PayPal+user+info`, req.nextUrl.origin)
      );
    }

    const userInfo = await userInfoResponse.json();
    const paypalEmail = userInfo.email;

    if (!paypalEmail) {
      return NextResponse.redirect(
        new URL(`/${lang}/profile/payout-settings?error=PayPal+email+not+found`, req.nextUrl.origin)
      );
    }

    // Guardar la cuenta en la base de datos
    const { error: upsertError } = await supabase
      .from('payout_accounts')
      .upsert({
        user_id: userId,
        provider: 'paypal',
        account_id: paypalEmail,
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
      new URL(`/${lang}/profile/payout-settings?success=paypal_connected`, req.nextUrl.origin)
    );
  } catch (error) {
    // Only log detailed errors in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error in PayPal Connect callback:', error);
    } else {
      console.error('Error in PayPal Connect callback');
    }
    return NextResponse.redirect(
      new URL(`/${i18n.defaultLocale}/profile/payout-settings?error=Internal+server+error`, req.nextUrl.origin)
    );
  }
}
