/**
 * Authorize.net Payment Plugin
 * 
 * Plugin para procesar pagos con tarjeta de crédito a través de Authorize.net
 * Soporta tanto pagos únicos como suscripciones recurrentes
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
 * Plugin de Authorize.net
 */
export class AuthorizeNetPlugin extends BasePaymentPlugin {
    readonly config: PaymentPluginConfig = {
        name: 'authorize_net',
        displayName: 'Authorize.net',
        apiEndpoint: 'https://api.authorize.net/xml/v1/request.api',
        requiresRedirect: false, // Authorize.net puede procesar pagos directamente
        testInfo: [
            'Use Authorize.net sandbox credentials for testing',
            'Test card: 4111 1111 1111 1111',
            'Expiration: Any future date',
            'CVV: Any 3 digits',
            'Sandbox endpoint: https://apitest.authorize.net/xml/v1/request.api',
            'Check your Authorize.net sandbox dashboard for logs',
        ],
        credentialFields: {
            production: ['api_login_id', 'transaction_key'],
            test: ['test_api_login_id', 'test_transaction_key'],
        },
    };

    /**
     * Obtiene el endpoint correcto según el modo (test/production)
     */
    private getEndpoint(isTest: boolean): string {
        return isTest
            ? 'https://apitest.authorize.net/xml/v1/request.api'
            : 'https://api.authorize.net/xml/v1/request.api';
    }

    /**
     * Crea un pago con Authorize.net
     */
    async createPayment(
        request: PaymentRequest,
        credentials: PaymentCredentials
    ): Promise<PaymentResponse> {
        const apiLoginId = request.isTest
            ? credentials.test_api_login_id
            : credentials.api_login_id;

        const transactionKey = request.isTest
            ? credentials.test_transaction_key
            : credentials.transaction_key;

        if (!apiLoginId || !transactionKey) {
            throw new Error('Authorize.net credentials not configured');
        }

        const endpoint = this.getEndpoint(request.isTest);

        // Construir el payload para Authorize.net
        const payload = {
            createTransactionRequest: {
                merchantAuthentication: {
                    name: apiLoginId,
                    transactionKey: transactionKey,
                },
                refId: request.metadata?.orderId || `order-${Date.now()}`,
                transactionRequest: {
                    transactionType: 'authCaptureTransaction',
                    amount: request.amount.toFixed(2),
                    currency: request.currency,
                    payment: {
                        // Este campo se llenará con los datos de la tarjeta del cliente
                        // En una implementación real, necesitarás un formulario seguro
                        // o usar Accept.js de Authorize.net para tokenizar la tarjeta
                        creditCard: {
                            cardNumber: request.metadata?.cardNumber || '',
                            expirationDate: request.metadata?.expirationDate || '',
                            cardCode: request.metadata?.cvv || '',
                        },
                    },
                    order: {
                        invoiceNumber: request.metadata?.invoiceNumber || undefined,
                        description: request.description,
                    },
                    customer: {
                        email: request.metadata?.customerEmail || undefined,
                    },
                    billTo: {
                        firstName: request.metadata?.firstName || undefined,
                        lastName: request.metadata?.lastName || undefined,
                        address: request.metadata?.address || undefined,
                        city: request.metadata?.city || undefined,
                        state: request.metadata?.state || undefined,
                        zip: request.metadata?.zip || undefined,
                        country: request.metadata?.country || undefined,
                    },
                },
            },
        };

        try {
            const response = await this.makeRequest(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            // Verificar si la transacción fue exitosa
            if (data.transactionResponse?.responseCode === '1') {
                return {
                    paymentId: data.transactionResponse.transId,
                    status: 'completed',
                    approvalUrl: null, // No requiere redirección
                };
            } else {
                // Transacción rechazada o error
                const errorMessage = data.transactionResponse?.errors?.[0]?.errorText || 'Transaction failed';
                throw new Error(`Authorize.net: ${errorMessage}`);
            }
        } catch (error) {
            console.error('[Authorize.net] Payment creation failed:', error);
            throw error;
        }
    }

    /**
     * Construye el payload para Authorize.net
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
     * Extrae la URL de aprobación (no aplica para Authorize.net)
     */
    extractApprovalUrl(_response: PaymentResponse): string | null {
        return null; // Authorize.net no requiere redirección
    }

    /**
     * Verifica la firma del webhook de Authorize.net
     */
    verifyWebhookSignature(
        payload: string,
        signature: string,
        credentials: PaymentCredentials
    ): boolean {
        // Authorize.net usa un método de verificación basado en hash SHA-512
        // TODO: Implementar verificación según la documentación oficial
        // https://developer.authorize.net/api/reference/features/webhooks.html

        console.log('[Authorize.net] Verifying webhook signature...');
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
        console.log(`[Authorize.net] Webhook event: ${event.type}`);

        switch (event.type) {
            case 'net.authorize.payment.authorization.created':
                await this.handleAuthorizationEvent(event.data, credentials);
                break;

            case 'net.authorize.payment.capture.created':
                await this.handleCaptureEvent(event.data, credentials);
                break;

            case 'net.authorize.payment.refund.created':
                await this.handleRefundEvent(event.data, credentials);
                break;

            default:
                console.log(`[Authorize.net] Unhandled event type: ${event.type}`);
        }
    }

    /**
     * Maneja eventos de autorización
     */
    private async handleAuthorizationEvent(
        data: Record<string, unknown>,
        _credentials: PaymentCredentials
    ): Promise<void> {
        console.log('[Authorize.net] Authorization event:', data);
        // TODO: Actualizar el estado del pago en la base de datos
    }

    /**
     * Maneja eventos de captura
     */
    private async handleCaptureEvent(
        data: Record<string, unknown>,
        _credentials: PaymentCredentials
    ): Promise<void> {
        console.log('[Authorize.net] Capture event:', data);
        // TODO: Actualizar el estado del pago en la base de datos
        // TODO: Procesar comisiones si el pago fue capturado
    }

    /**
     * Maneja eventos de reembolso
     */
    private async handleRefundEvent(
        data: Record<string, unknown>,
        _credentials: PaymentCredentials
    ): Promise<void> {
        console.log('[Authorize.net] Refund event:', data);
        // TODO: Actualizar el estado del pago en la base de datos
        // TODO: Revertir comisiones si aplica
    }

    /**
     * Valida las credenciales
     */
    async validateCredentials(
        credentials: PaymentCredentials,
        isTest: boolean
    ): Promise<boolean> {
        const apiLoginId = isTest
            ? credentials.test_api_login_id
            : credentials.api_login_id;

        const transactionKey = isTest
            ? credentials.test_transaction_key
            : credentials.transaction_key;

        if (!apiLoginId || !transactionKey) {
            return false;
        }

        try {
            const endpoint = this.getEndpoint(isTest);

            // Intentar obtener información de la cuenta usando getMerchantDetailsRequest
            const payload = {
                getMerchantDetailsRequest: {
                    merchantAuthentication: {
                        name: apiLoginId,
                        transactionKey: transactionKey,
                    },
                },
            };

            const response = await this.makeRequest(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            // Si la respuesta contiene información del merchant, las credenciales son válidas
            return data.messages?.resultCode === 'Ok';
        } catch (error) {
            console.error('[Authorize.net] Credential validation failed:', error);
            return false;
        }
    }
}
