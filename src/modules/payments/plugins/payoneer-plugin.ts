/**
 * Payoneer Payout Plugin
 * 
 * Plugin para enviar pagos globales a través de Payoneer
 * Principalmente usado para payouts (enviar dinero) a usuarios/afiliados
 */

import {
    BasePaymentPlugin,
    type PaymentPluginConfig,
    type PaymentRequest,
    type PaymentResponse,
    type PaymentCredentials,
    type WebhookEvent,
} from '../core/payment-plugin.interface';

/**
 * Plugin de Payoneer
 */
export class PayoneerPlugin extends BasePaymentPlugin {
    readonly config: PaymentPluginConfig = {
        name: 'payoneer',
        displayName: 'Payoneer',
        apiEndpoint: 'https://api.payoneer.com/v2/programs',
        requiresRedirect: false, // Payoneer procesa payouts directamente
        testInfo: [
            'Use Payoneer sandbox credentials for testing',
            'Sandbox endpoint: https://api.sandbox.payoneer.com/v2/programs',
            'Test payee email: Use your Payoneer sandbox account email',
            'Check your Payoneer Partner dashboard for logs',
            'Payouts are processed asynchronously',
        ],
        credentialFields: {
            production: ['api_username', 'api_password', 'partner_id'],
            test: ['test_api_username', 'test_api_password', 'test_partner_id'],
        },
    };

    /**
     * Obtiene el endpoint correcto según el modo (test/production)
     */
    private getEndpoint(isTest: boolean): string {
        return isTest
            ? 'https://api.sandbox.payoneer.com/v2/programs'
            : 'https://api.payoneer.com/v2/programs';
    }

    /**
     * Obtiene el Partner ID correcto según el modo
     */
    private getPartnerId(credentials: PaymentCredentials, isTest: boolean): string {
        return isTest
            ? credentials.test_partner_id || ''
            : credentials.partner_id || '';
    }

    /**
     * Crea las credenciales de autenticación Basic Auth
     */
    private getAuthHeader(credentials: PaymentCredentials, isTest: boolean): string {
        const username = isTest
            ? credentials.test_api_username
            : credentials.api_username;

        const password = isTest
            ? credentials.test_api_password
            : credentials.api_password;

        const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64');
        return `Basic ${base64Credentials}`;
    }

    /**
     * Crea un payout con Payoneer
     */
    async createPayment(
        request: PaymentRequest,
        credentials: PaymentCredentials
    ): Promise<PaymentResponse> {
        const username = request.isTest
            ? credentials.test_api_username
            : credentials.api_username;

        const password = request.isTest
            ? credentials.test_api_password
            : credentials.api_password;

        const partnerId = this.getPartnerId(credentials, request.isTest);

        if (!username || !password || !partnerId) {
            throw new Error('Payoneer credentials not configured');
        }

        const endpoint = this.getEndpoint(request.isTest);
        const authHeader = this.getAuthHeader(credentials, request.isTest);

        // Construir el payload para Payoneer
        const payload = {
            program_id: partnerId,
            payee_id: request.metadata?.payeeId || request.metadata?.userId,
            client_reference_id: request.metadata?.orderId || `payout-${Date.now()}`,
            amount: request.amount.toFixed(2),
            currency: request.currency,
            description: request.description,
            payee_email: request.metadata?.payeeEmail,
            // Información adicional del beneficiario
            payee: {
                first_name: request.metadata?.firstName,
                last_name: request.metadata?.lastName,
                email: request.metadata?.payeeEmail,
                country: request.metadata?.country || 'US',
            },
        };

        try {
            const response = await this.makeRequest(`${endpoint}/${partnerId}/payouts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            // Verificar si el payout fue creado exitosamente
            if (data.payout_id || data.status === 'pending') {
                return {
                    paymentId: data.payout_id || data.id,
                    status: 'pending', // Los payouts de Payoneer son asíncronos
                    approvalUrl: null,
                };
            } else {
                // Payout rechazado o error
                const errorMessage = data.error?.message || data.message || 'Payout failed';
                throw new Error(`Payoneer: ${errorMessage}`);
            }
        } catch (error) {
            console.error('[Payoneer] Payout creation failed:', error);
            throw error;
        }
    }

    /**
     * Construye el payload para Payoneer
     */
    buildPayload(request: PaymentRequest): Record<string, unknown> {
        return {
            amount: request.amount,
            currency: request.currency,
            description: request.description,
            isTest: request.isTest,
            metadata: request.metadata,
        };
    }

    /**
     * Extrae la URL de aprobación (no aplica para Payoneer)
     */
    extractApprovalUrl(_response: PaymentResponse): string | null {
        return null; // Payoneer no requiere redirección
    }

    /**
     * Verifica la firma del webhook de Payoneer
     */
    verifyWebhookSignature(
        payload: string,
        signature: string,
        credentials: PaymentCredentials
    ): boolean {
        // Payoneer usa un método de verificación basado en HMAC
        // TODO: Implementar verificación según la documentación oficial
        // https://developers.payoneer.com/docs/webhooks

        console.log('[Payoneer] Verifying webhook signature...');
        console.log('Payload length:', payload.length);
        console.log('Signature:', signature);
        console.log('Credentials available:', !!credentials);

        // Por ahora, aceptar todos los webhooks
        // En producción, debes implementar la verificación real
        return true;
    }

    /**
     * Maneja eventos de webhook
     */
    async handleWebhook(
        event: WebhookEvent,
        credentials: PaymentCredentials
    ): Promise<void> {
        console.log(`[Payoneer] Webhook event: ${event.type}`);

        switch (event.type) {
            case 'payout.completed':
                await this.handlePayoutCompletedEvent(event.data, credentials);
                break;

            case 'payout.failed':
                await this.handlePayoutFailedEvent(event.data, credentials);
                break;

            case 'payout.pending':
                await this.handlePayoutPendingEvent(event.data, credentials);
                break;

            case 'payout.cancelled':
                await this.handlePayoutCancelledEvent(event.data, credentials);
                break;

            default:
                console.log(`[Payoneer] Unhandled event type: ${event.type}`);
        }
    }

    /**
     * Maneja eventos de payout completado
     */
    private async handlePayoutCompletedEvent(
        data: Record<string, unknown>,
        _credentials: PaymentCredentials
    ): Promise<void> {
        console.log('[Payoneer] Payout completed:', data);
        // TODO: Actualizar el estado del payout en la base de datos
        // TODO: Notificar al usuario que recibió el pago
    }

    /**
     * Maneja eventos de payout fallido
     */
    private async handlePayoutFailedEvent(
        data: Record<string, unknown>,
        _credentials: PaymentCredentials
    ): Promise<void> {
        console.log('[Payoneer] Payout failed:', data);
        // TODO: Actualizar el estado del payout en la base de datos
        // TODO: Notificar al usuario del error
        // TODO: Revertir el balance si aplica
    }

    /**
     * Maneja eventos de payout pendiente
     */
    private async handlePayoutPendingEvent(
        data: Record<string, unknown>,
        _credentials: PaymentCredentials
    ): Promise<void> {
        console.log('[Payoneer] Payout pending:', data);
        // TODO: Actualizar el estado del payout en la base de datos
    }

    /**
     * Maneja eventos de payout cancelado
     */
    private async handlePayoutCancelledEvent(
        data: Record<string, unknown>,
        _credentials: PaymentCredentials
    ): Promise<void> {
        console.log('[Payoneer] Payout cancelled:', data);
        // TODO: Actualizar el estado del payout en la base de datos
        // TODO: Revertir el balance si aplica
    }

    /**
     * Valida las credenciales
     */
    async validateCredentials(
        credentials: PaymentCredentials,
        isTest: boolean
    ): Promise<boolean> {
        const username = isTest
            ? credentials.test_api_username
            : credentials.api_username;

        const password = isTest
            ? credentials.test_api_password
            : credentials.api_password;

        const partnerId = this.getPartnerId(credentials, isTest);

        if (!username || !password || !partnerId) {
            return false;
        }

        try {
            const endpoint = this.getEndpoint(isTest);
            const authHeader = this.getAuthHeader(credentials, isTest);

            // Intentar obtener información del programa
            const response = await this.makeRequest(`${endpoint}/${partnerId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                },
            });

            const data = await response.json();

            // Si la respuesta contiene información del programa, las credenciales son válidas
            return !!data.program_id || !!data.id;
        } catch (error) {
            console.error('[Payoneer] Credential validation failed:', error);
            return false;
        }
    }

    /**
     * Obtiene el estado de un payout
     */
    async getPayoutStatus(
        payoutId: string,
        credentials: PaymentCredentials,
        isTest: boolean
    ): Promise<string> {
        const endpoint = this.getEndpoint(isTest);
        const authHeader = this.getAuthHeader(credentials, isTest);
        const partnerId = this.getPartnerId(credentials, isTest);

        try {
            const response = await this.makeRequest(
                `${endpoint}/${partnerId}/payouts/${payoutId}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                    },
                }
            );

            const data = await response.json();
            return data.status || 'unknown';
        } catch (error) {
            console.error('[Payoneer] Failed to get payout status:', error);
            return 'error';
        }
    }

    /**
     * Cancela un payout pendiente
     */
    async cancelPayout(
        payoutId: string,
        credentials: PaymentCredentials,
        isTest: boolean
    ): Promise<boolean> {
        const endpoint = this.getEndpoint(isTest);
        const authHeader = this.getAuthHeader(credentials, isTest);
        const partnerId = this.getPartnerId(credentials, isTest);

        try {
            const response = await this.makeRequest(
                `${endpoint}/${partnerId}/payouts/${payoutId}/cancel`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                    },
                }
            );

            const data = await response.json();
            return data.status === 'cancelled';
        } catch (error) {
            console.error('[Payoneer] Failed to cancel payout:', error);
            return false;
        }
    }
}
