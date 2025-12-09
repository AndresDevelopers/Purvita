# Configuración de Webhooks y CORS

## 🔐 Seguridad de Webhooks

Esta aplicación procesa webhooks de Stripe y PayPal para gestionar pagos y suscripciones. Ambos webhooks incluyen **validación de firma** para prevenir ataques de falsificación.

---

## 📡 Webhook de Stripe

### ✅ Estado de Seguridad

**Implementado:** ✅ Validación de firma completa

### Configuración

El webhook de Stripe **ya está completamente protegido** con validación de firma.

#### 1. Obtener Webhook Secret de Stripe

1. Ve a [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Crea o selecciona un webhook
3. Copia el **Signing secret** (empieza con `whsec_`)

#### 2. Configurar en Admin Panel

La aplicación obtiene el webhook secret desde la base de datos:
- **Admin Panel** → **Payments** → **Stripe Configuration**
- Campo: **Webhook Secret**

#### 3. Endpoint del Webhook

```
POST /api/webhooks/stripe
```

#### 4. Eventos Soportados

- `invoice.paid`
- `invoice.payment_failed`
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

#### 5. Seguridad Implementada

✅ **Verificación de firma** con `stripe.webhooks.constructEvent()`
✅ **Idempotencia**: Prevención de procesamiento duplicado
✅ **Validación de metadata**: Verificación de estructura de datos

### Ejemplo de Configuración en Stripe

```
URL: https://tudominio.com/api/webhooks/stripe
Events to send:
  - invoice.paid
  - invoice.payment_failed
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted
```

---

## 📡 Webhook de PayPal

### ⚠️ Estado de Seguridad

**CRÍTICO:** Validación de firma implementada pero **requiere configuración**

### Problema Anterior

Antes de esta actualización, el webhook de PayPal **NO verificaba la firma**, permitiendo que cualquiera enviara peticiones falsas simulando pagos.

### Solución Implementada

✅ **Validación de firma completa** usando PayPal Webhook Verification API
⚠️ **Requiere configuración** del `PAYPAL_WEBHOOK_ID`

### Configuración (CRÍTICO para Producción)

#### 1. Crear Webhook en PayPal

**Sandbox (Testing):**
1. Ve a [PayPal Developer Dashboard - Sandbox](https://developer.paypal.com/dashboard/applications/sandbox)
2. Selecciona tu app → **Webhooks**
3. Click **Add Webhook**
4. URL: `https://tudominio.com/api/webhooks/paypal`
5. Events to send:
   - `PAYMENT.SALE.COMPLETED`
   - `CHECKOUT.ORDER.APPROVED`
6. Guarda y copia el **Webhook ID**

**Production:**
1. Ve a [PayPal Developer Dashboard - Live](https://developer.paypal.com/dashboard/applications/live)
2. Repite los mismos pasos

#### 2. Configurar Variable de Entorno

**OPCIÓN A: Variable de Entorno (Recomendada)**

Agrega a tu `.env.local` o variables de producción:

```bash
PAYPAL_WEBHOOK_ID=tu_webhook_id_aqui
```

**OPCIÓN B: Base de Datos**

Configura en el Admin Panel:
- **Admin Panel** → **Payments** → **PayPal Configuration**
- Campo: **Webhook ID** (agregar si no existe)

#### 3. Endpoint del Webhook

```
POST /api/webhooks/paypal
```

#### 4. Eventos Soportados

- `PAYMENT.SALE.COMPLETED`
- `CHECKOUT.ORDER.APPROVED`

#### 5. Seguridad Implementada

✅ **Verificación de firma** usando PayPal Webhook Verification API
✅ **Validación de headers** requeridos:
   - `paypal-transmission-id`
   - `paypal-transmission-time`
   - `paypal-transmission-sig`
   - `paypal-cert-url`
   - `paypal-auth-algo`
✅ **OAuth automático** para obtener access token
✅ **Soporte para Sandbox y Production**

### ⚠️ Advertencia de Seguridad

**Si `PAYPAL_WEBHOOK_ID` NO está configurado:**
- El webhook procesará pagos **SIN verificación de firma**
- Verás warning en logs: `⚠️ PayPal webhook signature verification skipped`
- **MUY PELIGROSO en producción**

**Para producción:**
```bash
# Vercel/Railway/Render
PAYPAL_WEBHOOK_ID=8A234BC5-678D-90EF-1234-56789ABCDEF0
```

### Cómo Obtener el Webhook ID

```bash
# El Webhook ID se muestra en PayPal Dashboard
# Formato: 8 caracteres-4-4-4-12 caracteres
# Ejemplo: 8A234BC5-678D-90EF-1234-56789ABCDEF0
```

### Verificar que Funciona

**Logs esperados (éxito):**
```
✅ PayPal webhook signature verified successfully
```

**Logs de error (fallo de verificación):**
```
❌ PayPal webhook signature verification failed
HTTP 401 Unauthorized
```

**Logs de warning (sin configurar):**
```
⚠️ PayPal webhook signature verification skipped: PAYPAL_WEBHOOK_ID not configured
⚠️ Configure PAYPAL_WEBHOOK_ID in environment variables for production security
```

---

## 🌐 Configuración de CORS

### Estado

**Implementado:** ✅ CORS configurable desde variables de entorno

### Configuración Básica

Por defecto, **CORS está DESHABILITADO** (solo same-origin).

Para habilitar CORS, configura los dominios permitidos:

```bash
# En .env.local o producción
ALLOWED_CORS_ORIGINS=https://tudominio.com,https://admin.tudominio.com,https://app.tudominio.com
```

### Formato

- **Múltiples dominios:** Separados por coma
- **Protocolo requerido:** Debe incluir `https://` o `http://`
- **Sin espacios:** No agregar espacios entre dominios
- **Sin trailing slash:** No terminar con `/`

### Ejemplos de Configuración

#### Desarrollo Local

```bash
# Permitir localhost en diferentes puertos
ALLOWED_CORS_ORIGINS=http://localhost:3000,http://localhost:9000
```

#### Producción Simple

```bash
# Un solo dominio
ALLOWED_CORS_ORIGINS=https://tudominio.com
```

#### Producción Multi-Dominio

```bash
# Frontend, admin panel, y aplicación móvil
ALLOWED_CORS_ORIGINS=https://tudominio.com,https://admin.tudominio.com,https://app.tudominio.com,https://mobile.tudominio.com
```

#### Staging + Production

```bash
# Staging
ALLOWED_CORS_ORIGINS=https://staging.tudominio.com

# Production
ALLOWED_CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com
```

### Headers de CORS Configurados

Cuando un origin es permitido, la API responde con:

```http
Access-Control-Allow-Origin: https://tudominio.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Max-Age: 86400
```

### Manejo de Preflight Requests

El middleware automáticamente maneja peticiones `OPTIONS` (preflight):

```http
OPTIONS /api/cualquier-endpoint
Origin: https://tudominio.com

→ HTTP 204 No Content (si permitido)
→ HTTP 403 Forbidden (si no permitido)
```

### Seguridad de CORS

#### ✅ Buenas Prácticas Implementadas

1. **Whitelist explícita**: Solo dominios configurados
2. **No wildcard**: No se permite `*`
3. **Validación estricta**: Origen debe coincidir exactamente
4. **Credentials habilitados**: Solo para orígenes confiables
5. **Cache de preflight**: 24 horas para reducir requests

#### ⚠️ NO Hacer Esto

```bash
# ❌ NUNCA uses wildcard en producción
ALLOWED_CORS_ORIGINS=*  # MUY INSEGURO

# ❌ NO incluyas orígenes no confiables
ALLOWED_CORS_ORIGINS=http://cualquierdominio.com

# ❌ NO uses HTTP en producción
ALLOWED_CORS_ORIGINS=http://tudominio.com  # Usar HTTPS
```

### Verificar CORS

#### Probar con cURL

```bash
# Preflight request
curl -X OPTIONS http://localhost:9000/api/cualquier-endpoint \
  -H "Origin: https://tudominio.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Esperado si permitido:
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: https://tudominio.com

# Esperado si NO permitido:
# HTTP/1.1 403 Forbidden
```

#### Probar con JavaScript

```javascript
// Desde https://tudominio.com
fetch('https://api.tudominio.com/api/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ test: true })
})
.then(res => res.json())
.then(data => console.log('✅ CORS funciona:', data))
.catch(err => console.error('❌ CORS bloqueado:', err))
```

### Debugging CORS

**Error común en navegador:**
```
Access to fetch at 'https://api.tudominio.com/api/test' from origin 'https://frontend.tudominio.com' has been blocked by CORS policy
```

**Solución:**
1. Verificar que `ALLOWED_CORS_ORIGINS` incluye `https://frontend.tudominio.com`
2. Reiniciar servidor después de cambiar `.env`
3. Verificar que no hay typos en el dominio
4. Confirmar que el protocolo es correcto (`https://` vs `http://`)

---

## 📊 Resumen de Seguridad

### Stripe Webhook
| Aspecto | Estado |
|---------|--------|
| Validación de firma | ✅ Implementado |
| Configuración requerida | ✅ En Admin Panel |
| Idempotencia | ✅ Implementado |
| Producción listo | ✅ Sí |

### PayPal Webhook
| Aspecto | Estado |
|---------|--------|
| Validación de firma | ✅ Implementado |
| Configuración requerida | ⚠️ **CRÍTICO: PAYPAL_WEBHOOK_ID** |
| Sin configuración | ⚠️ Funciona pero inseguro |
| Producción listo | ⚠️ Solo con PAYPAL_WEBHOOK_ID |

### CORS
| Aspecto | Estado |
|---------|--------|
| Configuración | ✅ Variables de entorno |
| Default | ✅ Deshabilitado (seguro) |
| Whitelist | ✅ Explícita |
| Wildcards | ✅ NO permitidos |
| Producción listo | ✅ Sí |

---

## ✅ Checklist de Producción

### Webhooks

- [ ] **Stripe:**
  - [ ] Webhook secret configurado en Admin Panel
  - [ ] Webhook creado en Stripe Dashboard
  - [ ] URL correcta: `https://tudominio.com/api/webhooks/stripe`
  - [ ] Eventos seleccionados correctamente

- [ ] **PayPal:**
  - [ ] Webhook creado en PayPal Dashboard (Live, no Sandbox)
  - [ ] `PAYPAL_WEBHOOK_ID` configurado en variables de entorno de producción
  - [ ] URL correcta: `https://tudominio.com/api/webhooks/paypal`
  - [ ] Eventos seleccionados correctamente
  - [ ] Probar con transacción real después de deploy

### CORS

- [ ] `ALLOWED_CORS_ORIGINS` configurado (si se necesita)
- [ ] Dominios usan `https://` (no `http://`)
- [ ] Sin trailing slashes en dominios
- [ ] Probado desde frontend con `fetch()`
- [ ] Preflight requests funcionan

---

## 🧪 Testing

### Probar Webhook de Stripe

```bash
# Usar Stripe CLI
stripe listen --forward-to localhost:9000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

### Probar Webhook de PayPal

1. Ir a PayPal Developer Dashboard → Webhooks
2. Seleccionar tu webhook
3. Click en "Send test notification"
4. Elegir evento `PAYMENT.SALE.COMPLETED`
5. Verificar logs del servidor

### Probar CORS

```bash
# Servidor con CORS habilitado
curl -X OPTIONS http://localhost:9000/api/test \
  -H "Origin: https://tudominio.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Debe retornar 204 con headers CORS
```

---

## 🔗 Referencias

- **Webhook Stripe:** `/src/app/api/webhooks/stripe/route.ts`
- **Webhook PayPal:** `/src/app/api/webhooks/paypal/route.ts`
- **CORS Utils:** `/src/lib/utils/cors.ts`
- **Middleware:** `/middleware.ts`
- **Env Config:** `/src/lib/env.ts`

---

**Última actualización:** 2025-11-02
**Versión:** 1.0.0
