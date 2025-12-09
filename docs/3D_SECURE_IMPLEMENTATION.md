# Implementación de 3D Secure / Strong Customer Authentication (SCA)

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [¿Qué es 3D Secure / SCA?](#qué-es-3d-secure--sca)
3. [Arquitectura de la Solución](#arquitectura-de-la-solución)
4. [Servicio de Detección de Riesgo](#servicio-de-detección-de-riesgo)
5. [Implementación por Proveedor](#implementación-por-proveedor)
6. [Flujos de Usuario](#flujos-de-usuario)
7. [Testing y Validación](#testing-y-validación)
8. [Monitoreo y Métricas](#monitoreo-y-métricas)

---

## Resumen Ejecutivo

Se ha implementado un sistema completo de **Strong Customer Authentication (SCA)** / **3D Secure** para proteger transacciones de alto riesgo en todos los métodos de pago:

- ✅ **Stripe**: 3D Secure dinámico con Payment Intents API
- ✅ **PayPal**: SCA con Cardinal Commerce
- ✅ **Wallet Interno**: Verificación adicional para transacciones de alto riesgo

**Beneficios:**
- 🛡️ Reducción de fraude en transacciones de alto valor
- 📉 Menor tasa de chargebacks
- ✅ Cumplimiento con PSD2 (Europa) y regulaciones globales
- 🎯 Experiencia de usuario optimizada (solo se activa cuando es necesario)

---

## ¿Qué es 3D Secure / SCA?

### 3D Secure (3DS)

**3D Secure** es un protocolo de seguridad para pagos con tarjeta que añade una capa adicional de autenticación:

- **3D Secure 1.0**: Redirección a página del banco (experiencia pobre)
- **3D Secure 2.0**: Autenticación en modal/iframe (mejor UX)

### Strong Customer Authentication (SCA)

**SCA** es un requisito de la directiva PSD2 de la Unión Europea que exige autenticación de dos factores para pagos electrónicos:

**Factores de autenticación:**
1. **Algo que sabes**: PIN, contraseña
2. **Algo que tienes**: Teléfono, token
3. **Algo que eres**: Huella digital, reconocimiento facial

**Excepciones SCA:**
- Transacciones de bajo valor (< €30)
- Pagos recurrentes (después del primer pago)
- Beneficiarios de confianza
- Análisis de riesgo (low-risk transactions)

---

## Arquitectura de la Solución

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    Payment Request                          │
│                  (Stripe/PayPal/Wallet)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PaymentRiskService                             │
│         (Evaluación de Riesgo en Tiempo Real)               │
│                                                             │
│  Factores:                                                  │
│  • Monto de transacción                                     │
│  • Historial del usuario                                    │
│  • Ubicación geográfica                                     │
│  • Velocidad de transacciones                               │
│  • Edad de la cuenta                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Risk Assessment Result                         │
│                                                             │
│  • requiresStrongAuth: boolean                              │
│  • riskScore: 0.0 - 1.0                                     │
│  • riskLevel: low | medium | high | critical                │
│  • riskFactors: Array<RiskFactor>                           │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┬───────────────┐
         ▼                       ▼               ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Stripe 3DS     │   │  PayPal SCA     │   │  Wallet 2FA     │
│                 │   │                 │   │                 │
│  Mode: 'any'    │   │  Mode:          │   │  Status: 202    │
│  or 'automatic' │   │  'SCA_ALWAYS'   │   │  verification_  │
│                 │   │  or             │   │  required       │
│                 │   │  'SCA_WHEN_     │   │                 │
│                 │   │  REQUIRED'      │   │                 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Servicio de Detección de Riesgo

### PaymentRiskService

**Ubicación:** `src/lib/services/payment-risk-service.ts`

### Factores de Riesgo Evaluados

#### 1. Monto de Transacción

| Monto (USD) | Severidad | Score |
|-------------|-----------|-------|
| >= $1,000   | High      | 0.4   |
| >= $500     | Medium    | 0.2   |
| >= $100     | Low       | 0.1   |
| < $100      | Low       | 0.0   |

#### 2. Historial del Usuario

| Condición | Severidad | Score |
|-----------|-----------|-------|
| Usuario en blacklist | Critical | 1.0 |
| Alertas de fraude recientes (30 días) | High | 0.5 |
| Historial limpio | Low | 0.0 |

#### 3. Ubicación Geográfica

| País | Severidad | Score |
|------|-----------|-------|
| Alto riesgo (NG, GH, PK, BD, ID, VN) | High | 0.3 |
| Riesgo medio (IN, BR, RU, CN, TR) | Medium | 0.15 |
| Bajo riesgo (otros) | Low | 0.0 |

#### 4. Velocidad de Transacciones

| Transacciones/Hora | Severidad | Score |
|--------------------|-----------|-------|
| >= 10 | Critical | 0.6 |
| >= 5  | High     | 0.3 |
| < 5   | Low      | 0.0 |

#### 5. Edad de la Cuenta

| Edad | Severidad | Score |
|------|-----------|-------|
| < 24 horas | High | 0.3 |
| < 7 días | Medium | 0.15 |
| >= 7 días | Low | 0.0 |

### Cálculo del Risk Score

```typescript
riskScore = min(sum(all_factor_scores), 1.0)
```

### Niveles de Riesgo

| Risk Score | Risk Level |
|------------|------------|
| >= 0.7     | Critical   |
| >= 0.4     | High       |
| >= 0.2     | Medium     |
| < 0.2      | Low        |

### Reglas de Autenticación Fuerte

Se requiere 3DS/SCA cuando:

1. **Risk Level = Critical** → Siempre
2. **Risk Level = High** → Siempre
3. **Monto >= $500 USD** → Siempre
4. **Risk Level = Medium AND Monto >= $100 USD** → Siempre

---

## Implementación por Proveedor

### 1. Stripe (3D Secure 2.0)

**Archivo:** `src/app/api/payments/stripe/create-checkout/route.ts`

**Configuración:**

```typescript
// Evaluar riesgo
const riskAssessment = await PaymentRiskService.assessRisk({
  userId,
  amountCents: validatedAmount,
  currency,
  ipAddress,
  countryCode: geoData.countryCode,
  paymentMethod: 'card',
});

// Configurar 3DS dinámicamente
const threeDSecureMode = riskAssessment.requiresStrongAuth ? 'any' : 'automatic';

// Crear sesión de checkout
const params = new URLSearchParams({
  // ... otros parámetros
  'payment_method_options[card][request_three_d_secure]': threeDSecureMode,
});
```

**Modos de 3DS:**

- **`any`**: Siempre requiere 3DS (transacciones de alto riesgo)
- **`automatic`**: Stripe decide basándose en sus reglas de riesgo (transacciones de riesgo medio/bajo)

**Flujo:**

1. Usuario inicia pago
2. Sistema evalúa riesgo
3. Si `requiresStrongAuth = true` → Modo `any`
4. Stripe muestra modal de 3DS
5. Usuario completa autenticación con su banco
6. Pago se procesa

**Ventajas:**
- ✅ 3D Secure 2.0 (mejor UX que 1.0)
- ✅ Modal integrado (no redirección)
- ✅ Soporte para biometría
- ✅ Cumplimiento automático con PSD2

---

### 2. PayPal (SCA con Cardinal Commerce)

**Archivo:** `src/app/api/payments/paypal/create-order/route.ts`

**Configuración:**

```typescript
// Evaluar riesgo
const riskAssessment = await PaymentRiskService.assessRisk({
  userId,
  amountCents: validatedAmountCents,
  currency,
  ipAddress,
  countryCode: geoData.countryCode,
  paymentMethod: 'paypal',
});

// Configurar SCA dinámicamente
const scaMode = riskAssessment.requiresStrongAuth ? 'SCA_ALWAYS' : 'SCA_WHEN_REQUIRED';

// Crear orden
const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
  method: 'POST',
  body: JSON.stringify({
    intent: 'CAPTURE',
    purchase_units: [{ /* ... */ }],
    payment_source: {
      card: {
        verification_method: scaMode,
        experience_context: {
          return_url: successReturnUrl,
          cancel_url: cancelReturnUrl,
        },
      },
    },
  }),
});
```

**Modos de SCA:**

- **`SCA_ALWAYS`**: Siempre requiere SCA (transacciones de alto riesgo)
- **`SCA_WHEN_REQUIRED`**: PayPal decide basándose en regulaciones y riesgo (transacciones de riesgo medio/bajo)

**Flujo:**

1. Usuario inicia pago con PayPal
2. Sistema evalúa riesgo
3. Si `requiresStrongAuth = true` → Modo `SCA_ALWAYS`
4. PayPal redirige a Cardinal Commerce para autenticación
5. Usuario completa autenticación (SMS, biometría, etc.)
6. Pago se procesa

**Ventajas:**
- ✅ Cumplimiento con PSD2
- ✅ Soporte para múltiples métodos de autenticación
- ✅ Integración con Cardinal Commerce (líder en 3DS)

---

### 3. Wallet Interno (Verificación Adicional)

**Archivo:** `src/app/api/payments/wallet/charge/route.ts`

**Configuración:**

```typescript
// Evaluar riesgo
const riskAssessment = await PaymentRiskService.assessRisk({
  userId: user.id,
  amountCents,
  currency,
  ipAddress,
  countryCode: geoData.countryCode,
  paymentMethod: 'wallet',
});

// Si requiere autenticación fuerte, retornar status 202
if (riskAssessment.requiresStrongAuth) {
  return NextResponse.json({
    status: 'verification_required',
    message: 'This transaction requires additional verification for security',
    riskLevel: riskAssessment.riskLevel,
    riskScore: riskAssessment.riskScore,
    riskFactors: riskAssessment.riskFactors.map(f => ({
      type: f.type,
      severity: f.severity,
      description: f.description,
    })),
    recommendation: riskAssessment.recommendation,
  }, { status: 202 }); // 202 Accepted - requires further action
}

// Procesar transacción normalmente
```

**Flujo Actual (Fase 1):**

1. Usuario inicia pago con Wallet
2. Sistema evalúa riesgo
3. Si `requiresStrongAuth = true` → Retorna `verification_required`
4. Frontend muestra mensaje al usuario
5. Usuario contacta soporte o espera revisión manual

**Flujo Futuro (Fase 2 - TODO):**

1. Usuario inicia pago con Wallet
2. Sistema evalúa riesgo
3. Si `requiresStrongAuth = true`:
   - Generar código de verificación
   - Enviar por email/SMS
   - Almacenar en tabla `pending_verifications`
   - Retornar `verification_required` con `verificationId`
4. Usuario ingresa código en frontend
5. Frontend llama a endpoint `/api/payments/wallet/verify`
6. Sistema valida código
7. Si válido → Procesar transacción
8. Si inválido → Rechazar

**Ventajas:**
- ✅ Control total sobre el flujo de verificación
- ✅ Flexibilidad para implementar múltiples métodos (email, SMS, TOTP)
- ✅ Sin costos adicionales de terceros

---

## Flujos de Usuario

### Flujo de Pago Normal (Bajo Riesgo)

```
Usuario → Selecciona producto → Checkout → Pago procesado ✅
```

### Flujo de Pago con 3DS (Alto Riesgo)

```
Usuario → Selecciona producto → Checkout → 3DS Modal → Autenticación → Pago procesado ✅
```

### Flujo de Pago con Wallet (Alto Riesgo)

```
Usuario → Selecciona producto → Checkout → Verificación requerida → Contactar soporte → Revisión manual → Pago procesado ✅
```

---

## Testing y Validación

### Stripe 3DS Testing

**Tarjetas de prueba:**

| Número de Tarjeta | Comportamiento |
|-------------------|----------------|
| `4000002500003155` | Requiere 3DS (autenticación exitosa) |
| `4000008260003178` | Requiere 3DS (autenticación fallida) |
| `4242424242424242` | No requiere 3DS |

**Procedimiento:**

1. Crear transacción de alto riesgo (>= $500 USD)
2. Usar tarjeta `4000002500003155`
3. Verificar que aparece modal de 3DS
4. Completar autenticación
5. Verificar que pago se procesa correctamente

### PayPal SCA Testing

**Cuenta de prueba:**

1. Crear cuenta de prueba en PayPal Sandbox
2. Configurar SCA en cuenta de prueba
3. Crear transacción de alto riesgo (>= $500 USD)
4. Verificar que aparece pantalla de SCA
5. Completar autenticación
6. Verificar que pago se procesa correctamente

### Wallet Testing

**Procedimiento:**

1. Crear usuario de prueba
2. Recargar wallet con fondos
3. Crear transacción de alto riesgo (>= $500 USD)
4. Verificar que retorna `status: 'verification_required'`
5. Verificar que frontend muestra mensaje apropiado

---

## Monitoreo y Métricas

### Métricas Clave

1. **Tasa de 3DS Activado**
   - % de transacciones que requieren 3DS
   - Meta: 10-20% (solo alto riesgo)

2. **Tasa de Autenticación Exitosa**
   - % de 3DS completados exitosamente
   - Meta: >= 85%

3. **Tasa de Abandono**
   - % de usuarios que abandonan en 3DS
   - Meta: <= 15%

4. **Tasa de Fraude**
   - % de transacciones fraudulentas
   - Meta: <= 0.5%

5. **Tasa de Chargebacks**
   - % de transacciones con chargeback
   - Meta: <= 1%

### Logs y Alertas

**Logs importantes:**

```typescript
console.log('[Stripe Checkout] Risk assessment:', {
  userId,
  amountCents: validatedAmount,
  riskScore: riskAssessment.riskScore,
  riskLevel: riskAssessment.riskLevel,
  requiresStrongAuth: riskAssessment.requiresStrongAuth,
  factorsCount: riskAssessment.riskFactors.length,
});

console.log('[Stripe Checkout] 3D Secure configuration:', {
  mode: threeDSecureMode,
  riskLevel: riskAssessment.riskLevel,
  requiresStrongAuth: riskAssessment.requiresStrongAuth,
});
```

**Alertas recomendadas:**

- ⚠️ Tasa de 3DS > 30% (demasiado restrictivo)
- ⚠️ Tasa de autenticación exitosa < 70% (problemas de UX)
- 🚨 Tasa de fraude > 1% (ajustar reglas de riesgo)
- 🚨 Tasa de chargebacks > 2% (ajustar reglas de riesgo)

---

## Próximos Pasos

### Fase 2: Wallet 2FA Completo

- [ ] Crear tabla `pending_verifications`
- [ ] Implementar generación de códigos de verificación
- [ ] Integrar servicio de email (SendGrid/AWS SES)
- [ ] Integrar servicio de SMS (Twilio)
- [ ] Crear endpoint `/api/payments/wallet/verify`
- [ ] Implementar frontend para ingreso de código
- [ ] Implementar TOTP (Google Authenticator)

### Fase 3: Optimización

- [ ] Machine Learning para detección de fraude
- [ ] Análisis de patrones de comportamiento
- [ ] Integración con servicios de threat intelligence
- [ ] A/B testing de reglas de riesgo
- [ ] Dashboard de métricas en tiempo real

---

## Conclusión

✅ **Implementación Completa de 3D Secure / SCA**

- **Stripe**: 3D Secure 2.0 dinámico ✅
- **PayPal**: SCA con Cardinal Commerce ✅
- **Wallet**: Verificación adicional (Fase 1) ✅

**Beneficios:**
- 🛡️ Protección contra fraude
- 📉 Reducción de chargebacks
- ✅ Cumplimiento regulatorio
- 🎯 UX optimizada

**Estado:** ✅ **LISTO PARA PRODUCCIÓN**

