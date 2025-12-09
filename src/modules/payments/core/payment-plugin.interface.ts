/**
 * Interfaz base para plugins de pago
 * 
 * Esta interfaz define el contrato que todos los proveedores de pago deben cumplir.
 * Esto hace que agregar nuevos proveedores sea más fácil y consistente.
 */

export interface PaymentCredentials {
  [key: string]: string | undefined;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  isTest?: boolean;
  successUrl?: string;
  cancelUrl?: string;
  originUrl?: string;
  metadata?: Record<string, unknown>;
  cartItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface PaymentResponse {
  approvalUrl?: string;
  paymentId?: string;
  status?: 'pending' | 'completed' | 'failed';
  [key: string]: unknown;
}

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
  signature?: string;
  timestamp?: string;
}

export interface PaymentPluginConfig {
  /** Nombre único del proveedor (ej: 'paypal', 'stripe', 'mercadopago') */
  name: string;
  
  /** Nombre para mostrar (ej: 'PayPal', 'Stripe', 'Mercado Pago') */
  displayName: string;
  
  /** Endpoint de la API para crear pagos */
  apiEndpoint: string;
  
  /** Si requiere redirección externa */
  requiresRedirect: boolean;
  
  /** Información de prueba para el panel admin */
  testInfo: string[];
  
  /** Campos de credenciales requeridos */
  credentialFields: {
    production: string[];
    test: string[];
  };
}

/**
 * Interfaz que todos los plugins de pago deben implementar
 */
export interface PaymentPlugin {
  /** Configuración del plugin */
  readonly config: PaymentPluginConfig;

  /**
   * Crea un pago
   */
  createPayment(
    request: PaymentRequest,
    credentials: PaymentCredentials
  ): Promise<PaymentResponse>;

  /**
   * Captura un pago (opcional, solo si el proveedor lo requiere)
   */
  capturePayment?(
    paymentId: string,
    credentials: PaymentCredentials
  ): Promise<void>;

  /**
   * Cancela un pago (opcional)
   */
  cancelPayment?(
    paymentId: string,
    credentials: PaymentCredentials
  ): Promise<void>;

  /**
   * Verifica la firma de un webhook
   */
  verifyWebhookSignature?(
    payload: string,
    signature: string,
    credentials: PaymentCredentials
  ): boolean;

  /**
   * Procesa un evento de webhook
   */
  handleWebhook?(
    event: WebhookEvent,
    credentials: PaymentCredentials
  ): Promise<void>;

  /**
   * Valida las credenciales (opcional, para el panel admin)
   */
  validateCredentials?(
    credentials: PaymentCredentials,
    isTest: boolean
  ): Promise<boolean>;

  /**
   * Construye el payload para la API del proveedor
   */
  buildPayload(request: PaymentRequest): Record<string, unknown>;

  /**
   * Extrae la URL de aprobación de la respuesta
   */
  extractApprovalUrl(response: PaymentResponse): string | null;
}

/**
 * Clase base abstracta para facilitar la implementación de plugins
 */
export abstract class BasePaymentPlugin implements PaymentPlugin {
  abstract readonly config: PaymentPluginConfig;

  abstract createPayment(
    request: PaymentRequest,
    credentials: PaymentCredentials
  ): Promise<PaymentResponse>;

  abstract buildPayload(request: PaymentRequest): Record<string, unknown>;

  abstract extractApprovalUrl(response: PaymentResponse): string | null;

  // Métodos opcionales con implementación por defecto
  async capturePayment?(
    _paymentId: string,
    _credentials: PaymentCredentials
  ): Promise<void> {
    throw new Error(`${this.config.name} does not support manual capture`);
  }

  async cancelPayment?(
    _paymentId: string,
    _credentials: PaymentCredentials
  ): Promise<void> {
    throw new Error(`${this.config.name} does not support cancellation`);
  }

  verifyWebhookSignature?(
    _payload: string,
    _signature: string,
    _credentials: PaymentCredentials
  ): boolean {
    console.warn(`${this.config.name} webhook signature verification not implemented`);
    return true;
  }

  async handleWebhook?(
    event: WebhookEvent,
    _credentials: PaymentCredentials
  ): Promise<void> {
    console.log(`${this.config.name} webhook event:`, event.type);
  }

  async validateCredentials?(
    credentials: PaymentCredentials,
    isTest: boolean
  ): Promise<boolean> {
    // Validación básica: verificar que existan las credenciales requeridas
    const requiredFields = isTest 
      ? this.config.credentialFields.test 
      : this.config.credentialFields.production;

    return requiredFields.every(field => !!credentials[field]);
  }

  /**
   * Helper para hacer requests HTTP
   */
  protected async makeRequest(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.config.name} API error: ${error}`);
    }

    return response;
  }

  /**
   * Helper para construir URLs de retorno
   */
  protected buildReturnUrls(request: PaymentRequest): {
    successUrl: string;
    cancelUrl: string;
  } {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    return {
      successUrl: request.successUrl || `${baseUrl}/payment/result?provider=${this.config.name}&status=success`,
      cancelUrl: request.cancelUrl || `${baseUrl}/payment/result?provider=${this.config.name}&status=cancel`,
    };
  }
}

