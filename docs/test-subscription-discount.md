# Guía de Pruebas - Descuento por Suscripción

## 🧪 Pruebas de Funcionalidad

### Paso 1: Configurar Descuentos en Admin

1. Iniciar sesión como administrador
2. Navegar a `/admin/app-settings`
3. Configurar los descuentos por fase:

```
Fase 0 (Registration):        0%  descuento
Fase 1 (First Partners):      5%  descuento
Fase 2 (Duplicate Team):     10%  descuento
Fase 3 (Network Momentum):   15%  descuento
```

4. Guardar cambios
5. Verificar en la consola del navegador que no hay errores

### Paso 2: Verificar Configuración en Base de Datos

Ejecutar en Supabase SQL Editor:

```sql
-- Ver configuración de descuentos por fase
SELECT 
  level,
  name,
  commission_rate,
  subscription_discount_rate,
  credit_cents
FROM phase_levels
ORDER BY level;
```

**Resultado esperado:**
```
level | name              | commission_rate | subscription_discount_rate | credit_cents
------|-------------------|-----------------|----------------------------|-------------
0     | Registration      | 0.08            | 0.00                       | 0
1     | First Partners    | 0.15            | 0.05                       | 0
2     | Duplicate Team    | 0.30            | 0.10                       | 12500
3     | Network Momentum  | 0.40            | 0.15                       | 24000
```

### Paso 3: Crear Usuarios de Prueba en Diferentes Fases

```sql
-- Usuario en Fase 0 (sin descuento)
INSERT INTO phases (user_id, phase, ecommerce_commission)
VALUES ('user-id-fase-0', 0, 0.08)
ON CONFLICT (user_id) DO UPDATE SET phase = 0;

-- Usuario en Fase 1 (5% descuento)
INSERT INTO phases (user_id, phase, ecommerce_commission)
VALUES ('user-id-fase-1', 1, 0.15)
ON CONFLICT (user_id) DO UPDATE SET phase = 1;

-- Usuario en Fase 2 (10% descuento)
INSERT INTO phases (user_id, phase, ecommerce_commission)
VALUES ('user-id-fase-2', 2, 0.30)
ON CONFLICT (user_id) DO UPDATE SET phase = 2;

-- Usuario en Fase 3 (15% descuento)
INSERT INTO phases (user_id, phase, ecommerce_commission)
VALUES ('user-id-fase-3', 3, 0.40)
ON CONFLICT (user_id) DO UPDATE SET phase = 3;
```

### Paso 4: Probar API de Checkout

#### Prueba 1: Usuario Fase 0 (Sin descuento)

**Request:**
```bash
curl -X POST http://localhost:3000/api/subscription/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-fase-0",
    "planId": "plan-id-here",
    "provider": "stripe",
    "locale": "en"
  }'
```

**Response esperada:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_...",
  "plan": {
    "id": "...",
    "price": 34.00
  }
  // No debe incluir campo "discount"
}
```

**Logs esperados:**
```
[SubscriptionCheckout] User user-id-fase-0 (Phase 0): Applying 0.0% discount. 
Original: 3400 cents, Discount: 0 cents, Final: 3400 cents
```

#### Prueba 2: Usuario Fase 1 (5% descuento)

**Request:**
```bash
curl -X POST http://localhost:3000/api/subscription/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-fase-1",
    "planId": "plan-id-here",
    "provider": "stripe",
    "locale": "en"
  }'
```

**Response esperada:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_...",
  "plan": {
    "id": "...",
    "price": 34.00
  },
  "discount": {
    "originalAmountCents": 3400,
    "discountAmountCents": 170,
    "finalAmountCents": 3230,
    "discountRate": 0.05,
    "userPhase": 1
  }
}
```

**Cálculo:**
- Precio original: $34.00 (3400 cents)
- Descuento 5%: $1.70 (170 cents)
- Precio final: $32.30 (3230 cents)

#### Prueba 3: Usuario Fase 2 (10% descuento)

**Response esperada:**
```json
{
  "discount": {
    "originalAmountCents": 3400,
    "discountAmountCents": 340,
    "finalAmountCents": 3060,
    "discountRate": 0.10,
    "userPhase": 2
  }
}
```

**Cálculo:**
- Precio original: $34.00 (3400 cents)
- Descuento 10%: $3.40 (340 cents)
- Precio final: $30.60 (3060 cents)

#### Prueba 4: Usuario Fase 3 (15% descuento)

**Response esperada:**
```json
{
  "discount": {
    "originalAmountCents": 3400,
    "discountAmountCents": 510,
    "finalAmountCents": 2890,
    "discountRate": 0.15,
    "userPhase": 3
  }
}
```

**Cálculo:**
- Precio original: $34.00 (3400 cents)
- Descuento 15%: $5.10 (510 cents)
- Precio final: $28.90 (2890 cents)

### Paso 5: Verificar en Stripe Dashboard

1. Ir a Stripe Dashboard → Payments
2. Buscar la sesión de checkout creada
3. Verificar que el monto coincide con el precio con descuento
4. Revisar metadata:
   - `subscriptionDiscountRate`: debe mostrar el porcentaje
   - `userPhase`: debe mostrar la fase del usuario

### Paso 6: Probar con PayPal

**Request:**
```bash
curl -X POST http://localhost:3000/api/subscription/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-fase-2",
    "planId": "plan-id-here",
    "provider": "paypal",
    "locale": "en"
  }'
```

**Verificar:**
1. La URL de aprobación de PayPal
2. El monto en PayPal debe ser el precio con descuento
3. Response debe incluir el objeto `discount`

### Paso 7: Probar con Wallet

**Request:**
```bash
curl -X POST http://localhost:3000/api/subscription/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-fase-3",
    "planId": "plan-id-here",
    "provider": "wallet",
    "locale": "en"
  }'
```

**Verificar:**
1. El monto debitado del wallet debe ser el precio con descuento
2. Response debe incluir el objeto `discount`
3. Verificar en tabla `wallet_txns` que el monto es correcto

## 📊 Tabla de Resultados Esperados

| Fase | Descuento | Precio Original | Descuento $ | Precio Final |
|------|-----------|-----------------|-------------|--------------|
| 0    | 0%        | $34.00          | $0.00       | $34.00       |
| 1    | 5%        | $34.00          | $1.70       | $32.30       |
| 2    | 10%       | $34.00          | $3.40       | $30.60       |
| 3    | 15%       | $34.00          | $5.10       | $28.90       |

## 🔍 Verificación de Logs

Buscar en los logs del servidor:

```bash
# Filtrar logs de descuentos aplicados
grep "Subscription discount applied" logs/server.log

# Ejemplo de log esperado:
[SubscriptionCheckout] Subscription discount applied for user abc123: 
Phase 2, Rate 10.0%, Original $34.00, Discount $3.40, Final $30.60
```

## ⚠️ Casos de Error a Probar

### Error 1: Usuario sin fase asignada

**Setup:**
```sql
DELETE FROM phases WHERE user_id = 'user-without-phase';
```

**Resultado esperado:**
- No debe fallar
- Debe usar precio original (sin descuento)
- Logs: "Error fetching user phase" o fase = 0

### Error 2: Fase inválida en configuración

**Setup:**
```sql
-- Eliminar configuración de fase 2
DELETE FROM phase_levels WHERE level = 2;
```

**Resultado esperado:**
- Usuario en fase 2 debe recibir descuento = 0%
- Debe usar precio original

### Error 3: Descuento mayor a 100%

**Setup:**
```sql
UPDATE phase_levels SET subscription_discount_rate = 1.5 WHERE level = 3;
```

**Resultado esperado:**
- Validación debe prevenir esto en el admin
- Si se fuerza en DB, el precio final no debe ser negativo

## ✅ Checklist de Verificación

- [ ] Configuración se guarda correctamente en admin
- [ ] Descuentos se aplican en Stripe
- [ ] Descuentos se aplican en PayPal
- [ ] Descuentos se aplican en Wallet
- [ ] Metadata incluye información del descuento
- [ ] Logs muestran cálculos correctos
- [ ] Response incluye objeto `discount` cuando aplica
- [ ] Usuarios sin descuento no reciben objeto `discount`
- [ ] Manejo de errores funciona correctamente
- [ ] Precios finales son correctos en todos los casos

## 🐛 Troubleshooting

### Problema: Descuento no se aplica

**Verificar:**
1. Usuario tiene fase asignada en tabla `phases`
2. Configuración de descuento > 0% en `phase_levels`
3. Cache de settings está actualizado (esperar 5 minutos o reiniciar servidor)

### Problema: Precio incorrecto

**Verificar:**
1. Logs del servidor para ver cálculo
2. Metadata en Stripe/PayPal
3. Conversión de cents a dollars es correcta

### Problema: Error en checkout

**Verificar:**
1. Logs de error en servidor
2. Conexión a base de datos
3. Credenciales de Stripe/PayPal configuradas

