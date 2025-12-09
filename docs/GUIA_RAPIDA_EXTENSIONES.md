# 🚀 Guía Rápida para Extensiones

Esta guía te muestra cómo agregar nuevos idiomas y métodos de pago de forma **rápida y fácil**.

---

## 🌍 Agregar un Nuevo Idioma

### ⏱️ Tiempo: 5-10 minutos (configuración) + tiempo de traducción

### Método 1: Usando el Script Automatizado (RECOMENDADO)

```bash
# Agregar francés
npm run add-language -- --code fr --name "Français"

# Agregar portugués
npm run add-language -- --code pt --name "Português"

# Agregar alemán
npm run add-language -- --code de --name "Deutsch"
```

El script automáticamente:
- ✅ Crea el archivo de traducciones
- ✅ Lo registra en el sistema
- ✅ Te muestra los próximos pasos

### Método 2: Manual (si prefieres hacerlo a mano)

#### Paso 1: Crear archivo de traducciones

**Archivo:** `src/i18n/dictionaries/locales/fr.ts`

```typescript
import type { DictionaryOverrides } from '../types';

export const createFrDictionary = (
  appName: string,
): DictionaryOverrides => ({
  appName,
  
  navigation: {
    products: "Produits",
    dashboard: "Tableau de bord",
    team: "Équipe",
    // ... más traducciones
  },
  
  // Solo traduces lo que necesitas
  // El resto se hereda del inglés automáticamente
});
```

#### Paso 2: Registrar el idioma

**Archivo:** `src/i18n/dictionaries/locales/index.ts`

```typescript
import { createFrDictionary } from './fr';  // ← Agregar

export const localeFactories = {
  en: createEnDictionary,
  es: createEsDictionary,
  fr: createFrDictionary,  // ← Agregar
} satisfies Record<string, DictionaryFactory>;
```

#### Paso 3: Agregar bandera (opcional)

Agrega la imagen de la bandera en: `public/flags/fr.png`

### ✅ ¡Listo!

El idioma aparecerá automáticamente en:
- Selector de idiomas del header
- Rutas: `/fr/dashboard`, `/fr/products`, etc.
- Panel admin: `?lang=fr`

---

## 💳 Agregar un Nuevo Método de Pago

### ⏱️ Tiempo: 30 minutos - 2 horas (dependiendo de la complejidad)

### Método 1: Usando el Script Automatizado (RECOMENDADO)

```bash
# Agregar Mercado Pago
npm run add-payment -- --name mercadopago --display "Mercado Pago"

# Agregar Square
npm run add-payment -- --name square --display "Square"

# Agregar cualquier otro
npm run add-payment -- --name [nombre] --display "[Nombre para mostrar]"
```

El script automáticamente crea:
- ✅ Servicio del proveedor
- ✅ API routes (create-order)
- ✅ Webhook route
- ✅ Estructura básica lista para implementar

### Método 2: Usando el Sistema de Plugins (NUEVO - MÁS FÁCIL)

#### Paso 1: Crear tu plugin

**Archivo:** `src/modules/payments/plugins/mercadopago-plugin.ts`

```typescript
import { BasePaymentPlugin } from '../core/payment-plugin.interface';

export class MercadoPagoPlugin extends BasePaymentPlugin {
  readonly config = {
    name: 'mercadopago',
    displayName: 'Mercado Pago',
    apiEndpoint: 'https://api.mercadopago.com',
    requiresRedirect: true,
    testInfo: [
      'Use Mercado Pago sandbox credentials',
      'Test cards: https://www.mercadopago.com/developers',
    ],
    credentialFields: {
      production: ['access_token', 'public_key'],
      test: ['test_access_token', 'test_public_key'],
    },
  };

  async createPayment(request, credentials) {
    // Tu lógica aquí
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        items: [{
          title: request.description,
          quantity: 1,
          unit_price: request.amount,
        }],
      }),
    });

    const data = await response.json();
    return { approvalUrl: data.init_point };
  }

  buildPayload(request) {
    return {
      amount: request.amount,
      currency: request.currency,
      description: request.description,
    };
  }

  extractApprovalUrl(response) {
    return response.approvalUrl || null;
  }
}
```

#### Paso 2: Registrar el plugin

**Archivo:** `src/modules/payments/plugins/index.ts`

```typescript
import { MercadoPagoPlugin } from './mercadopago-plugin';

const plugins = [
  new PayPalPlugin(),
  new StripePlugin(),
  new WalletPlugin(),
  new MercadoPagoPlugin(),  // ← Solo agregar esta línea
];
```

### ✅ ¡Listo!

El sistema detectará automáticamente el nuevo proveedor.

---

## 📊 Comparación de Métodos

### Para Idiomas

| Método | Tiempo | Dificultad | Recomendado |
|--------|--------|------------|-------------|
| Script CLI | 5 min | ⭐ Muy fácil | ✅ Sí |
| Manual | 10 min | ⭐⭐ Fácil | Solo si prefieres control total |

### Para Métodos de Pago

| Método | Tiempo | Dificultad | Recomendado |
|--------|--------|------------|-------------|
| Sistema de Plugins | 30 min - 2h | ⭐⭐ Fácil | ✅ Sí (nuevo) |
| Script CLI | 1-2h | ⭐⭐⭐ Media | Para scaffold inicial |
| Manual completo | 4-8h | ⭐⭐⭐⭐⭐ Difícil | ❌ No recomendado |

---

## 🎯 Ejemplos Completos

### Ejemplo 1: Agregar Francés

```bash
# 1. Generar archivos
npm run add-language -- --code fr --name "Français"

# 2. Editar traducciones
# Abrir: src/i18n/dictionaries/locales/fr.ts
# Traducir las claves necesarias

# 3. Agregar bandera
# Descargar de: https://flagicons.lipis.dev/
# Guardar en: public/flags/fr.png

# 4. Probar
npm run dev
# Visitar: http://localhost:3000/fr
```

### Ejemplo 2: Agregar Mercado Pago

```bash
# 1. Generar estructura básica
npm run add-payment -- --name mercadopago --display "Mercado Pago"

# 2. Crear plugin (más fácil que editar múltiples archivos)
# Crear: src/modules/payments/plugins/mercadopago-plugin.ts
# Copiar ejemplo de: src/modules/payments/plugins/example-plugin.ts

# 3. Registrar plugin
# Editar: src/modules/payments/plugins/index.ts
# Agregar: new MercadoPagoPlugin()

# 4. Implementar lógica
# Seguir TODOs en el código generado

# 5. Probar
npm run dev
# Ir a: /admin/pays
```

---

## 🔧 Configuración de Scripts en package.json

Agrega estos scripts a tu `package.json`:

```json
{
  "scripts": {
    "add-language": "tsx scripts/add-language.ts",
    "add-payment": "tsx scripts/add-payment-provider.ts"
  }
}
```

Si no tienes `tsx` instalado:

```bash
npm install -D tsx
```

---

## 📚 Recursos Adicionales

### Para Idiomas
- **Archivo base**: `src/i18n/dictionaries/default.ts` (6,813 líneas en inglés)
- **Ejemplo español**: `src/i18n/dictionaries/locales/es.ts`
- **Servicios de traducción**:
  - DeepL API: https://www.deepl.com/pro-api (mejor calidad)
  - Google Translate API: https://cloud.google.com/translate

### Para Métodos de Pago
- **Ejemplos de referencia**: 
  - PayPal: `src/modules/payments/services/payment-providers/paypal-service.ts`
  - Stripe: `src/modules/payments/services/payment-providers/stripe-service.ts`
- **Plugin de ejemplo**: `src/modules/payments/plugins/example-plugin.ts`
- **Documentación**: `docs/payment-system.md`

---

## ❓ Preguntas Frecuentes

### ¿Necesito reiniciar el servidor después de agregar un idioma?
Sí, reinicia el servidor de desarrollo (`npm run dev`).

### ¿Puedo agregar un idioma sin traducir todo?
Sí, solo traduce lo que necesites. El resto se heredará del inglés automáticamente.

### ¿Cómo pruebo un nuevo método de pago?
1. Configura las credenciales en `/admin/pays`
2. Usa el modo "test" del proveedor
3. Prueba desde el checkout o el panel de pruebas

### ¿Qué pasa si mi proveedor de pago no requiere redirección?
Configura `requiresRedirect: false` en el plugin y maneja el pago directamente.

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs de la consola
2. Verifica que seguiste todos los pasos
3. Consulta los ejemplos de referencia
4. Revisa la documentación completa en `docs/`

---

**¡Feliz desarrollo! 🚀**

