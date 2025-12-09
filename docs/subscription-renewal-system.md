# Sistema de Renovación Automática de Suscripciones

## Descripción General

El sistema de renovación automática de suscripciones permite que las suscripciones activas se renueven automáticamente al final de su período sin intervención del usuario, utilizando el método de pago guardado.

## Características Principales

### 1. Actualización de Método de Pago Sin Cobro

Cuando un usuario con suscripción activa actualiza su método de pago:

- **NO se cobra inmediatamente** al usuario
- El método de pago se **guarda** para futuras renovaciones
- El cobro automático ocurre **solo cuando la suscripción está por vencer**
- Si el usuario cancela su suscripción (`cancel_at_period_end = true`), **no se cobra** automáticamente

### 2. Flujo de Actualización de Método de Pago

```
Usuario con suscripción activa
    ↓
Hace clic en "Update payment method"
    ↓
Selecciona nuevo método de pago (Stripe/PayPal/Wallet)
    ↓
Sistema guarda el método en `subscriptions.default_payment_method_id`
    ↓
NO se procesa ningún pago
    ↓
Mensaje: "Payment method updated successfully. It will be used for future renewals."
```

### 3. Flujo de Renovación Automática

```
Cron job ejecuta diariamente (00:00 UTC)
    ↓
Busca suscripciones que vencen en 1 día
    ↓
Verifica: status = 'active' AND cancel_at_period_end = false
    ↓
Obtiene default_payment_method_id
    ↓
Procesa pago según gateway (Stripe/PayPal/Wallet)
    ↓
Si éxito: Actualiza current_period_end a +30 días
    ↓
Si falla: Marca suscripción como 'past_due'
```

## Componentes del Sistema

### 1. Base de Datos

**Tabla: `subscriptions`**
```sql
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS default_payment_method_id uuid 
REFERENCES public.payment_methods(id) ON DELETE SET NULL;
```

**Campos relevantes:**
- `default_payment_method_id`: ID del método de pago guardado
- `current_period_end`: Fecha de vencimiento de la suscripción
- `cancel_at_period_end`: Si es `true`, no se renueva automáticamente
- `status`: Estado de la suscripción (`active`, `past_due`, `cancelled`)
- `gateway`: Proveedor de pago (`stripe`, `paypal`, `wallet`)

### 2. API Endpoints

#### POST `/api/subscription/update-payment-method`

Actualiza el método de pago sin cobrar.

**Request:**
```json
{
  "provider": "stripe" | "paypal" | "wallet",
  "paymentMethodId": "pm_xxx" // Solo para Stripe
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment method updated successfully"
}
```

#### GET/POST `/api/cron/subscription-renewals`

Endpoint de cron job para procesar renovaciones automáticas.

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalProcessed": 10,
    "successful": 8,
    "failed": 2
  },
  "timestamp": "2025-01-31T00:00:00.000Z"
}
```

### 3. Servicios

#### `SubscriptionRenewalService`

Servicio principal para manejar renovaciones automáticas.

**Métodos principales:**
- `processRenewals(daysBeforeExpiry)`: Procesa todas las renovaciones pendientes
- `renewWithStripe()`: Renueva usando Stripe
- `renewWithWallet()`: Renueva usando Wallet
- `renewWithPayPal()`: Renueva usando PayPal (requiere configuración adicional)

**Ubicación:** `src/modules/multilevel/services/subscription-renewal-service.ts`

### 4. Frontend

#### `subscription-content.tsx`

Componente de gestión de suscripciones.

**Cambios implementados:**
- Detecta si el usuario tiene suscripción activa
- Muestra diálogo diferente para "Update payment method" vs "New subscription"
- Llama a `/api/subscription/update-payment-method` para actualizaciones
- Llama a `/api/subscription/checkout` para nuevas suscripciones

**Ubicación:** `src/app/[lang]/subscription/subscription-content.tsx`

## Configuración

### Variables de Entorno

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# PayPal
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx

# Cron Security
CRON_SECRET=your-secure-random-string
```

### Vercel Cron Configuration

**Archivo:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/subscription-renewals",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Horario:** Diariamente a las 00:00 UTC

## Proveedores de Pago

### Stripe

✅ **Totalmente soportado**

- Guarda métodos de pago usando Stripe Payment Methods API
- Procesa pagos automáticos con `off_session: true`
- Maneja fallos de pago automáticamente

### Wallet

✅ **Totalmente soportado**

- Verifica balance antes de renovar
- Deduce automáticamente del balance del usuario
- Marca como `past_due` si el balance es insuficiente

### PayPal

⚠️ **Soporte limitado**

- Requiere configuración de PayPal Billing Agreements
- Actualmente marca como `past_due` para renovación manual
- Implementación completa pendiente

## Manejo de Errores

### Pago Fallido

Cuando un pago automático falla:

1. La suscripción se marca como `past_due`
2. El usuario recibe notificación (si está configurado)
3. El usuario puede actualizar su método de pago
4. El sistema intentará renovar nuevamente en el próximo ciclo

### Balance Insuficiente (Wallet)

1. Se verifica el balance antes de procesar
2. Si es insuficiente, se marca como `past_due`
3. El usuario debe recargar su wallet
4. La renovación se procesará en el próximo ciclo

## Seguridad

### Autenticación del Cron Job

El endpoint de cron requiere un token secreto:

```typescript
const authHeader = req.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Pagos Off-Session

Los pagos automáticos usan el flag `off_session: true` de Stripe:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: amountCents,
  currency: 'usd',
  payment_method: paymentMethodId,
  confirm: true,
  off_session: true, // Permite pagos sin interacción del usuario
  metadata: {
    userId,
    intent: 'subscription_renewal',
  },
});
```

## Testing

### Probar Actualización de Método de Pago

1. Crear una suscripción activa
2. Ir a la página de suscripciones
3. Hacer clic en "Update payment method"
4. Seleccionar un nuevo método de pago
5. Verificar que NO se cobra inmediatamente
6. Verificar que `default_payment_method_id` se actualiza en la base de datos

### Probar Renovación Automática

1. Crear una suscripción con `current_period_end` en 1 día
2. Ejecutar manualmente el cron job:
   ```bash
   curl -X GET http://localhost:3000/api/cron/subscription-renewals \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
3. Verificar que el pago se procesa
4. Verificar que `current_period_end` se actualiza a +30 días

### Probar Cancelación

1. Crear una suscripción activa
2. Cancelar la suscripción (marca `cancel_at_period_end = true`)
3. Esperar a que llegue `current_period_end`
4. Verificar que NO se procesa renovación automática
5. Verificar que la suscripción se marca como `cancelled`

## Monitoreo

### Logs

Todos los eventos importantes se registran en la consola:

```
[SubscriptionRenewal] Starting renewal processing...
[SubscriptionRenewal] Found 10 subscriptions to renew
[SubscriptionRenewal] Processing renewal for user abc123
[SubscriptionRenewal] Stripe renewal succeeded for user abc123
[SubscriptionRenewal] Renewal processing complete: { total: 10, successful: 8, failed: 2 }
```

### Métricas Recomendadas

- Total de renovaciones procesadas por día
- Tasa de éxito de renovaciones
- Suscripciones en estado `past_due`
- Métodos de pago fallidos

## Próximos Pasos

1. ✅ Migración de base de datos
2. ✅ API de actualización de método de pago
3. ✅ Servicio de renovación automática
4. ✅ Cron job configurado
5. ✅ Frontend actualizado
6. ⏳ Implementar notificaciones por email
7. ⏳ Implementar PayPal Billing Agreements
8. ⏳ Agregar dashboard de métricas de renovación
9. ⏳ Implementar reintentos automáticos para pagos fallidos

## Soporte

Para problemas o preguntas sobre el sistema de renovación automática, consultar:

- Documentación de Stripe: https://stripe.com/docs/billing/subscriptions/overview
- Documentación de PayPal: https://developer.paypal.com/docs/subscriptions/
- Código fuente: `src/modules/multilevel/services/subscription-renewal-service.ts`

