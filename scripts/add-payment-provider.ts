#!/usr/bin/env tsx
/**
 * Script para agregar un nuevo proveedor de pago
 * 
 * Uso:
 *   npm run add-payment -- --name mercadopago --display "Mercado Pago"
 *   npm run add-payment -- --name square --display "Square"
 */

import * as fs from 'fs';
import * as path from 'path';

interface ProviderConfig {
  name: string;
  displayName: string;
}

function parseArgs(): ProviderConfig {
  const args = process.argv.slice(2);
  const config: Partial<ProviderConfig> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      config.name = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--display' && args[i + 1]) {
      config.displayName = args[i + 1];
      i++;
    }
  }

  if (!config.name || !config.displayName) {
    console.error('❌ Error: Se requieren --name y --display');
    console.log('\nUso:');
    console.log('  npm run add-payment -- --name mercadopago --display "Mercado Pago"');
    process.exit(1);
  }

  return config as ProviderConfig;
}

function createProviderService(name: string, displayName: string): void {
  const dir = path.join(process.cwd(), 'src/modules/payments/services/payment-providers');
  const filePath = path.join(dir, `${name}-service.ts`);

  if (fs.existsSync(filePath)) {
    console.log(`⚠️  El servicio ${name}-service.ts ya existe. Saltando...`);
    return;
  }

  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

  const content = `import type { PaymentRequest, PaymentResponse } from '../payment-service';
import { PAYMENT_CONSTANTS } from '../../constants/payment-constants';

/**
 * ${displayName} Payment Service
 * 
 * TODO: Implementar la integración con ${displayName}
 * Documentación: [Agregar URL de la documentación de ${displayName}]
 */
export class ${capitalizedName}Service {
  /**
   * Crea un pago con ${displayName}
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    // TODO: Implementar la lógica de creación de pago
    
    // Ejemplo de estructura:
    const response = await fetch('https://api.${name}.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.${name.toUpperCase()}_ACCESS_TOKEN}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        // Agregar más campos según la API de ${displayName}
      }),
    });

    if (!response.ok) {
      throw new Error(\`${displayName} payment creation failed\`);
    }

    const data = await response.json();

    return {
      approvalUrl: data.approval_url || data.checkout_url, // Ajustar según la respuesta de ${displayName}
      paymentId: data.id,
    };
  }

  /**
   * Captura un pago aprobado (si aplica)
   */
  async capturePayment(paymentId: string): Promise<void> {
    // TODO: Implementar si ${displayName} requiere captura manual
    console.log(\`Capturing payment: \${paymentId}\`);
  }

  /**
   * Cancela un pago (si aplica)
   */
  async cancelPayment(paymentId: string): Promise<void> {
    // TODO: Implementar cancelación
    console.log(\`Cancelling payment: \${paymentId}\`);
  }
}
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Creado: ${filePath}`);
}

function createApiRoutes(name: string, displayName: string): void {
  const baseDir = path.join(process.cwd(), 'src/app/api/payments', name);
  
  // Crear directorio
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Create Order Route
  const createOrderDir = path.join(baseDir, 'create-order');
  if (!fs.existsSync(createOrderDir)) {
    fs.mkdirSync(createOrderDir, { recursive: true });
  }

  const createOrderPath = path.join(createOrderDir, 'route.ts');
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

  const createOrderContent = `import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GatewayCredentialsService } from '@/modules/payments/services/gateway-credentials-service';
import { PaymentError } from '@/modules/payments/utils/payment-errors';

const CreateOrderSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string(),
  isTest: z.boolean().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  originUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, currency, description, isTest, successUrl, cancelUrl, originUrl, metadata } = 
      CreateOrderSchema.parse(body);

    // Obtener credenciales
    const requestedEnvironment = isTest === true ? 'test' : isTest === false ? 'live' : 'auto';
    const { credentials, record } = await GatewayCredentialsService.getProviderCredentials(
      '${name}',
      requestedEnvironment,
    );

    if (record.status !== 'active') {
      return NextResponse.json(
        { error: '${displayName} is not active' },
        { status: 400 },
      );
    }

    // TODO: Implementar la creación de orden con ${displayName}
    // Usar credentials.access_token, credentials.client_id, etc.

    const approvalUrl = 'https://checkout.${name}.com/...'; // TODO: Obtener de la respuesta

    return NextResponse.json({
      approvalUrl,
      paymentId: 'payment_id_from_${name}',
    });
  } catch (error) {
    console.error('[${capitalizedName}CreateOrder] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create ${displayName} order' },
      { status: 500 },
    );
  }
}
`;

  fs.writeFileSync(createOrderPath, createOrderContent, 'utf-8');
  console.log(`✅ Creado: ${createOrderPath}`);
}

function createWebhookRoute(name: string, displayName: string): void {
  const webhookDir = path.join(process.cwd(), 'src/app/api/webhooks', name);
  
  if (!fs.existsSync(webhookDir)) {
    fs.mkdirSync(webhookDir, { recursive: true });
  }

  const webhookPath = path.join(webhookDir, 'route.ts');
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

  const webhookContent = `import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * Webhook de ${displayName}
 * 
 * TODO: Configurar la URL del webhook en el panel de ${displayName}:
 * https://tu-dominio.com/api/webhooks/${name}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    
    // TODO: Verificar la firma del webhook
    const signature = headersList.get('x-${name}-signature');
    // Implementar verificación de firma según la documentación de ${displayName}

    const event = JSON.parse(body);

    console.log('[${capitalizedName}Webhook] Event received:', event.type);

    // TODO: Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'payment.completed':
        // Manejar pago completado
        await handlePaymentCompleted(event.data);
        break;
      
      case 'payment.failed':
        // Manejar pago fallido
        await handlePaymentFailed(event.data);
        break;

      default:
        console.log(\`[${capitalizedName}Webhook] Unhandled event type: \${event.type}\`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[${capitalizedName}Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}

async function handlePaymentCompleted(data: any) {
  // TODO: Implementar lógica de pago completado
  console.log('Payment completed:', data);
}

async function handlePaymentFailed(data: any) {
  // TODO: Implementar lógica de pago fallido
  console.log('Payment failed:', data);
}
`;

  fs.writeFileSync(webhookPath, webhookContent, 'utf-8');
  console.log(`✅ Creado: ${webhookPath}`);
}

function showNextSteps(name: string, _displayName: string): void {
  console.log('\n' + '='.repeat(70));
  console.log('🎉 ¡Proveedor de pago generado exitosamente!');
  console.log('='.repeat(70));
  console.log(`\n📋 Archivos creados:\n`);
  console.log(`✅ src/modules/payments/services/payment-providers/${name}-service.ts`);
  console.log(`✅ src/app/api/payments/${name}/create-order/route.ts`);
  console.log(`✅ src/app/api/webhooks/${name}/route.ts`);
  
  console.log(`\n📝 Próximos pasos MANUALES:\n`);
  
  console.log(`1. Actualizar el schema de proveedores:`);
  console.log(`   Archivo: src/modules/payments/domain/models/payment-gateway.ts`);
  console.log(`   Cambiar: z.enum(['paypal', 'stripe', 'wallet'])`);
  console.log(`   Por:     z.enum(['paypal', 'stripe', 'wallet', '${name}'])`);
  
  console.log(`\n2. Registrar en el Factory:`);
  console.log(`   Archivo: src/modules/payments/factories/payment-provider-factory.ts`);
  console.log(`   Agregar configuración para '${name}'`);
  
  console.log(`\n3. Actualizar tipos de credenciales:`);
  console.log(`   Archivo: src/modules/payments/types/payment-types.ts`);
  console.log(`   Agregar interface ${name.charAt(0).toUpperCase() + name.slice(1)}Credentials`);
  
  console.log(`\n4. Actualizar Gateway Credentials Service:`);
  console.log(`   Archivo: src/modules/payments/services/gateway-credentials-service.ts`);
  console.log(`   Agregar '${name}' al ProviderCredentialMap`);
  
  console.log(`\n5. Actualizar base de datos:`);
  console.log(`   Ejecutar SQL para agregar registro en payment_gateways`);
  
  console.log(`\n6. Implementar la lógica en los archivos generados`);
  console.log(`   Buscar comentarios "TODO" en los archivos creados`);
  
  console.log(`\n7. Agregar UI en el admin (opcional):`);
  console.log(`   src/modules/payments/controllers/admin-payment-settings-controller.tsx`);
  
  console.log('\n' + '='.repeat(70));
  console.log('📚 Documentación útil:');
  console.log(`   - Revisa docs/payment-system.md para más detalles`);
  console.log(`   - Usa PayPal/Stripe como referencia de implementación`);
  console.log('='.repeat(70) + '\n');
}

// Main
async function main() {
  console.log('\n💳 Generador de Proveedores de Pago - PūrVita Network\n');

  const config = parseArgs();

  console.log(`Generando proveedor: ${config.displayName} (${config.name})\n`);

  // Crear archivos
  createProviderService(config.name, config.displayName);
  createApiRoutes(config.name, config.displayName);
  createWebhookRoute(config.name, config.displayName);

  // Mostrar siguientes pasos
  showNextSteps(config.name, config.displayName);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

