/**
 * EJEMPLO: Plugin de Mercado Pago
 * 
 * Este es un ejemplo de cómo crear un nuevo plugin de pago.
 * Copia este archivo y modifícalo según el proveedor que quieras agregar.
 * 
 * Pasos:
 * 1. Copia este archivo y renómbralo (ej: square-plugin.ts)
 * 2. Modifica la clase y configuración según tu proveedor
 * 3. Implementa los métodos requeridos
 * 4. Registra el plugin en plugins/index.ts
 * 5. ¡Listo! El sistema lo detectará automáticamente
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
 * Plugin de Mercado Pago
 */
export class MercadoPagoPlugin extends BasePaymentPlugin {
  readonly config: PaymentPluginConfig = {
    name: 'mercadopago',
    displayName: 'Mercado Pago',
    apiEndpoint: 'https://api.mercadopago.com',
    requiresRedirect: true,
    testInfo: [
      'Use Mercado Pago sandbox credentials for testing',
      'Test payments won\'t charge real money',
      'Test cards: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/testing',
      'Check your Mercado Pago dashboard for logs',
    ],
    credentialFields: {
      production: ['access_token', 'public_key'],
      test: ['test_access_token', 'test_public_key'],
    },
  };

  /**
   * Crea un pago con Mercado Pago
   */
  async createPayment(
    request: PaymentRequest,
    credentials: PaymentCredentials
  ): Promise<PaymentResponse> {
    const accessToken = request.isTest 
      ? credentials.test_access_token 
      : credentials.access_token;

    if (!accessToken) {
      throw new Error('Mercado Pago access token not configured');
    }

    const { successUrl, cancelUrl } = this.buildReturnUrls(request);

    // Crear preferencia de pago
    const response = await this.makeRequest(
      `${this.config.apiEndpoint}/checkout/preferences`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              title: request.description,
              quantity: 1,
              unit_price: request.amount,
              currency_id: request.currency,
            },
          ],
          back_urls: {
            success: successUrl,
            failure: cancelUrl,
            pending: cancelUrl,
          },
          auto_return: 'approved',
          external_reference: request.metadata?.orderId || undefined,
        }),
      }
    );

    const data = await response.json();

    return {
      approvalUrl: data.init_point,
      paymentId: data.id,
      status: 'pending',
    };
  }

  /**
   * Construye el payload para Mercado Pago
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
   * Extrae la URL de aprobación
   */
  extractApprovalUrl(response: PaymentResponse): string | null {
    return response.approvalUrl || null;
  }

  /**
   * Verifica la firma del webhook de Mercado Pago
   */
  verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _credentials: PaymentCredentials
  ): boolean {
    // TODO: Implementar verificación de firma según la documentación de Mercado Pago
    // https://www.mercadopago.com.ar/developers/es/docs/checkout-api/webhooks
    
    console.log('Verifying Mercado Pago webhook signature...');
    return true; // Por ahora, aceptar todos
  }

  /**
   * Maneja eventos de webhook
   */
  async handleWebhook(
    event: WebhookEvent,
    credentials: PaymentCredentials
  ): Promise<void> {
    console.log(`[MercadoPago] Webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment':
        await this.handlePaymentEvent(event.data, credentials);
        break;
      
      default:
        console.log(`[MercadoPago] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Maneja eventos de pago
   */
  private async handlePaymentEvent(
    data: Record<string, unknown>,
    credentials: PaymentCredentials
  ): Promise<void> {
    const paymentId = data.id as string;
    
    // Obtener detalles del pago
    const accessToken = credentials.access_token;
    
    const response = await this.makeRequest(
      `${this.config.apiEndpoint}/v1/payments/${paymentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const payment = await response.json();

    console.log('[MercadoPago] Payment status:', payment.status);

    // TODO: Actualizar el estado del pago en la base de datos
    // TODO: Procesar comisiones si el pago fue aprobado
  }

  /**
   * Valida las credenciales
   */
  async validateCredentials(
    credentials: PaymentCredentials,
    isTest: boolean
  ): Promise<boolean> {
    const accessToken = isTest 
      ? credentials.test_access_token 
      : credentials.access_token;

    if (!accessToken) {
      return false;
    }

    try {
      // Intentar obtener información de la cuenta
      const response = await this.makeRequest(
        `${this.config.apiEndpoint}/users/me`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();
      return !!data.id;
    } catch (error) {
      console.error('[MercadoPago] Credential validation failed:', error);
      return false;
    }
  }
}

/**
 * EJEMPLO 2: Plugin de Square
 * 
 * Otro ejemplo más simple
 */
export class SquarePlugin extends BasePaymentPlugin {
  readonly config: PaymentPluginConfig = {
    name: 'square',
    displayName: 'Square',
    apiEndpoint: 'https://connect.squareup.com',
    requiresRedirect: true,
    testInfo: [
      'Use Square sandbox credentials for testing',
      'Test card: 4111 1111 1111 1111',
      'Check your Square dashboard for logs',
    ],
    credentialFields: {
      production: ['access_token', 'location_id'],
      test: ['sandbox_access_token', 'sandbox_location_id'],
    },
  };

  async createPayment(
    _request: PaymentRequest,
    _credentials: PaymentCredentials
  ): Promise<PaymentResponse> {
    // TODO: Implementar integración con Square
    throw new Error('Square integration not implemented yet');
  }

  buildPayload(request: PaymentRequest): Record<string, unknown> {
    return {
      amount: Math.round(request.amount * 100), // Square usa centavos
      currency: request.currency,
      description: request.description,
    };
  }

  extractApprovalUrl(response: PaymentResponse): string | null {
    return response.approvalUrl || null;
  }
}

