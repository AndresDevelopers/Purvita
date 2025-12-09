# Payment Gateways - Authorize.net y Payoneer

Esta documentación explica cómo configurar y usar los nuevos payment gateways: **Authorize.net** y **Payoneer**.

## 📋 Tabla de Contenidos

- [Authorize.net](#authorizenet)
  - [Configuración](#configuración-authorizenet)
  - [Uso](#uso-authorizenet)
  - [Testing](#testing-authorizenet)
- [Payoneer](#payoneer)
  - [Configuración](#configuración-payoneer)
  - [Uso](#uso-payoneer)
  - [Testing](#testing-payoneer)

---

## Authorize.net

Authorize.net es un gateway de pago que permite procesar pagos con tarjeta de crédito y débito. Es ideal para **recibir pagos** de clientes.

### Configuración (Authorize.net)

#### 1. Obtener Credenciales

**Producción:**
1. Ir a: https://account.authorize.net/
2. Iniciar sesión en tu cuenta
3. Navegar a: **Account → Settings → API Credentials & Keys**
4. Copiar:
   - **API Login ID**
   - **Transaction Key**

**Sandbox/Test:**
1. Crear cuenta sandbox en: https://developer.authorize.net/hello_world/sandbox/
2. Seguir los mismos pasos que en producción

#### 2. Configurar Variables de Entorno

Agregar al archivo `.env.local`:

```bash
# Authorize.net - Producción
AUTHORIZE_NET_API_LOGIN_ID=tu_api_login_id
AUTHORIZE_NET_TRANSACTION_KEY=tu_transaction_key

# Authorize.net - Test/Sandbox
AUTHORIZE_NET_TEST_API_LOGIN_ID=tu_test_api_login_id
AUTHORIZE_NET_TEST_TRANSACTION_KEY=tu_test_transaction_key
```

#### 3. Activar desde el Admin Panel

1. Ir a: **Admin → Pays**
2. Buscar la tarjeta de **Authorize.net**
3. Configurar:
   - **Status**: Activar
   - **Functionality**: Payment (Recibir Pagos)
   - **Mode**: Test o Production
4. Guardar cambios

### Uso (Authorize.net)

El plugin de Authorize.net se usa automáticamente cuando:
- El usuario selecciona pagar con tarjeta de crédito
- Authorize.net está configurado como gateway activo
- El modo (test/production) coincide con la configuración

**Características:**
- ✅ Procesamiento directo (sin redirección)
- ✅ Soporte para tarjetas de crédito y débito
- ✅ Validación de credenciales
- ✅ Webhooks para notificaciones
- ✅ Modo test y producción

### Testing (Authorize.net)

**Tarjetas de Prueba:**

```
Número: 4111 1111 1111 1111
Expiración: Cualquier fecha futura (ej: 12/2025)
CVV: Cualquier 3 dígitos (ej: 123)
```

**Otros escenarios:**
- **Rechazada**: 4000 0000 0000 0002
- **Fondos insuficientes**: 4000 0000 0000 9995

**Verificar transacciones:**
- Dashboard sandbox: https://sandbox.authorize.net/

---

## Payoneer

Payoneer es una plataforma de pagos globales que permite **enviar dinero** a usuarios en todo el mundo. Es ideal para **payouts** (pagos a afiliados, comisiones, etc.).

### Configuración (Payoneer)

#### 1. Obtener Credenciales

**Producción:**
1. Ir a: https://payouts.payoneer.com/partners/
2. Iniciar sesión en tu cuenta de Payoneer
3. Navegar a: **Settings → API Credentials**
4. Copiar:
   - **API Username**
   - **API Password**
   - **Partner ID** (Program ID)

**Sandbox/Test:**
1. Solicitar acceso sandbox en: https://payouts.payoneer.com/partners/
2. Contactar soporte de Payoneer para obtener credenciales sandbox

#### 2. Configurar Variables de Entorno

Agregar al archivo `.env.local`:

```bash
# Payoneer - Producción
PAYONEER_API_USERNAME=tu_api_username
PAYONEER_API_PASSWORD=tu_api_password
PAYONEER_PARTNER_ID=tu_partner_id

# Payoneer - Test/Sandbox
PAYONEER_TEST_API_USERNAME=tu_test_api_username
PAYONEER_TEST_API_PASSWORD=tu_test_api_password
PAYONEER_TEST_PARTNER_ID=tu_test_partner_id
```

#### 3. Activar desde el Admin Panel

1. Ir a: **Admin → Pays**
2. Buscar la tarjeta de **Payoneer**
3. Configurar:
   - **Status**: Activar
   - **Functionality**: Payout (Enviar Pagos)
   - **Mode**: Test o Production
4. Guardar cambios

### Uso (Payoneer)

El plugin de Payoneer se usa para:
- Enviar comisiones a afiliados
- Pagar ganancias de red MLM
- Transferencias a usuarios

**Características:**
- ✅ Pagos globales (200+ países)
- ✅ Múltiples monedas
- ✅ Procesamiento asíncrono
- ✅ Webhooks para notificaciones de estado
- ✅ Modo test y producción

**Ejemplo de uso programático:**

```typescript
import { paymentPluginRegistry } from '@/modules/payments/plugins';

const payoneerPlugin = paymentPluginRegistry.get('payoneer');

const payout = await payoneerPlugin.createPayment(
  {
    amount: 100.00,
    currency: 'USD',
    description: 'Comisión de afiliado - Enero 2025',
    isTest: false,
    metadata: {
      payeeId: 'user-123',
      payeeEmail: 'afiliado@example.com',
      firstName: 'Juan',
      lastName: 'Pérez',
      country: 'MX',
    },
  },
  credentials
);

console.log('Payout ID:', payout.paymentId);
console.log('Status:', payout.status); // 'pending'
```

### Testing (Payoneer)

**Datos de Prueba:**

```
Payee Email: Tu email de cuenta sandbox de Payoneer
Country: US (o cualquier país soportado)
Amount: Cualquier monto (ej: 10.00)
Currency: USD
```

**Estados de Payout:**
- `pending`: Payout creado, en proceso
- `completed`: Payout completado exitosamente
- `failed`: Payout falló
- `cancelled`: Payout cancelado

**Verificar payouts:**
- Dashboard sandbox: https://payouts.sandbox.payoneer.com/

**Webhooks:**
Payoneer enviará notificaciones a tu webhook endpoint cuando:
- Un payout se complete
- Un payout falle
- Un payout sea cancelado

---

## 🔧 Troubleshooting

### Authorize.net

**Error: "Authorize.net credentials not configured"**
- Verificar que las variables de entorno estén configuradas
- Verificar que el modo (test/production) coincida con las credenciales

**Error: "Transaction failed"**
- Verificar que la tarjeta sea válida
- Verificar fondos suficientes
- Revisar logs en el dashboard de Authorize.net

### Payoneer

**Error: "Payoneer credentials not configured"**
- Verificar que las 3 credenciales estén configuradas (username, password, partner_id)
- Verificar que el modo (test/production) coincida

**Error: "Payout failed"**
- Verificar que el email del beneficiario tenga cuenta Payoneer
- Verificar que el país sea soportado
- Verificar saldo suficiente en tu cuenta Payoneer

---

## 📚 Recursos Adicionales

### Authorize.net
- [Documentación oficial](https://developer.authorize.net/api/reference/)
- [Guía de integración](https://developer.authorize.net/api/reference/index.html#payment-transactions)
- [Webhooks](https://developer.authorize.net/api/reference/features/webhooks.html)

### Payoneer
- [Documentación oficial](https://developers.payoneer.com/)
- [API Reference](https://developers.payoneer.com/docs/api-reference)
- [Webhooks](https://developers.payoneer.com/docs/webhooks)

---

## 🆘 Soporte

Si encuentras problemas:
1. Revisar los logs en el dashboard del proveedor
2. Verificar las credenciales en `.env.local`
3. Verificar que el modo (test/production) sea correcto
4. Contactar soporte del proveedor si el problema persiste
