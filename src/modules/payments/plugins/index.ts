/**
 * Registro de Plugins de Pago
 * 
 * PARA AGREGAR UN NUEVO PROVEEDOR:
 * 
 * 1. Crea tu plugin en un archivo separado (ej: mercadopago-plugin.ts)
 * 2. Importa tu plugin aquí
 * 3. Agrégalo al array de plugins
 * 4. ¡Listo! El sistema lo detectará automáticamente
 * 
 * No necesitas modificar ningún otro archivo.
 */

import { registerPaymentPlugins } from '../core/payment-plugin-registry';
import type { PaymentPlugin } from '../core/payment-plugin.interface';

// Importar plugins existentes (cuando los migres)
// import { PayPalPlugin } from './paypal-plugin';
// import { StripePlugin } from './stripe-plugin';
// import { WalletPlugin } from './wallet-plugin';

// Importar nuevos plugins
import { AuthorizeNetPlugin } from './authorize-net-plugin';
import { PayoneerPlugin } from './payoneer-plugin';
// import { MercadoPagoPlugin } from './mercadopago-plugin';
// import { SquarePlugin } from './square-plugin';

/**
 * Lista de todos los plugins de pago disponibles
 *
 * Para agregar un nuevo proveedor, simplemente agrega una nueva instancia aquí:
 *
 * const plugins = [
 *   new PayPalPlugin(),
 *   new StripePlugin(),
 *   new WalletPlugin(),
 *   new MercadoPagoPlugin(),  // ← Nuevo proveedor
 *   new SquarePlugin(),       // ← Otro nuevo proveedor
 * ];
 */
const plugins: PaymentPlugin[] = [
  // Descomentar cuando migres los plugins existentes:
  // new PayPalPlugin(),
  // new StripePlugin(),
  // new WalletPlugin(),

  // Nuevos plugins agregados:
  new AuthorizeNetPlugin(),
  new PayoneerPlugin(),

  // Agregar más plugins aquí:
  // new MercadoPagoPlugin(),
  // new SquarePlugin(),
];

// Registrar todos los plugins
registerPaymentPlugins(plugins);

// Exportar para uso en otros módulos
export { paymentPluginRegistry } from '../core/payment-plugin-registry';
export * from '../core/payment-plugin.interface';

