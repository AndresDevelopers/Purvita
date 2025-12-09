import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProfileEarningsService } from '@/modules/profile/services/profile-earnings-service';

/**
 * POST /api/profile/earnings/authorize-net-connect
 *
 * Conecta la cuenta bancaria del usuario para recibir pagos via Authorize.Net ACH.
 * El usuario proporciona su información bancaria (routing number, account number, nombre).
 */
export async function POST(req: NextRequest) {
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

        // Obtener los datos del cuerpo de la solicitud
        const body = await req.json().catch(() => null);

        if (!body) {
            return NextResponse.json(
                { error: 'Request body is required' },
                { status: 400 }
            );
        }

        // Conectar la cuenta usando el servicio
        const service = new ProfileEarningsService(supabase);
        const result = await service.connectAuthorizeNetAccount(user.id, body);

        return NextResponse.json({
            success: true,
            account: {
                provider: result.account.provider,
                status: result.account.status,
                created: result.created,
            },
        });
    } catch (error) {
        console.error('Error connecting Authorize.Net account:', error);

        const message = error instanceof Error ? error.message : 'Internal server error';
        const isValidationError = message.includes('Routing') ||
            message.includes('Account') ||
            message.includes('holder') ||
            message.includes('enabled');

        return NextResponse.json(
            { error: message },
            { status: isValidationError ? 400 : 500 }
        );
    }
}
