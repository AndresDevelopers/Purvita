/**
 * Registro centralizado de plugins de pago
 * 
 * Este archivo hace que agregar nuevos proveedores sea tan simple como:
 * 1. Crear una clase que implemente PaymentPlugin
 * 2. Registrarla aquí
 * 
 * No necesitas modificar múltiples archivos en diferentes lugares.
 */

import type { PaymentPlugin } from './payment-plugin.interface';

/**
 * Registro de todos los plugins de pago disponibles
 */
class PaymentPluginRegistry {
  private plugins = new Map<string, PaymentPlugin>();

  /**
   * Registra un nuevo plugin de pago
   */
  register(plugin: PaymentPlugin): void {
    if (this.plugins.has(plugin.config.name)) {
      console.warn(`Payment plugin "${plugin.config.name}" is already registered. Overwriting...`);
    }
    
    this.plugins.set(plugin.config.name, plugin);
    console.log(`✅ Registered payment plugin: ${plugin.config.displayName} (${plugin.config.name})`);
  }

  /**
   * Obtiene un plugin por nombre
   */
  get(name: string): PaymentPlugin {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      throw new Error(`Payment plugin "${name}" not found. Available: ${this.getAvailableNames().join(', ')}`);
    }
    
    return plugin;
  }

  /**
   * Verifica si un plugin está registrado
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Obtiene todos los plugins registrados
   */
  getAll(): PaymentPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Obtiene los nombres de todos los plugins disponibles
   */
  getAvailableNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Obtiene la configuración de todos los plugins
   */
  getAllConfigs() {
    return this.getAll().map(plugin => plugin.config);
  }

  /**
   * Limpia todos los plugins (útil para testing)
   */
  clear(): void {
    this.plugins.clear();
  }
}

// Singleton
export const paymentPluginRegistry = new PaymentPluginRegistry();

/**
 * Helper para registrar múltiples plugins a la vez
 */
export function registerPaymentPlugins(plugins: PaymentPlugin[]): void {
  plugins.forEach(plugin => paymentPluginRegistry.register(plugin));
}

/**
 * Decorator para auto-registrar plugins
 * 
 * Uso:
 * @RegisterPaymentPlugin
 * export class MyPaymentPlugin extends BasePaymentPlugin { ... }
 */
export function RegisterPaymentPlugin(constructor: new () => PaymentPlugin) {
  const instance = new constructor();
  paymentPluginRegistry.register(instance);
  return constructor;
}

