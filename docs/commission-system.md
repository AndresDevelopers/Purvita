# Sistema de Comisiones MLM

## Descripción General

El sistema de comisiones multinivel (MLM) de PūrVita Network genera ganancias automáticas cuando ocurren compras o pagos de suscripción en la red. El sistema está completamente integrado con la configuración dinámica de `app-settings`.

## Tipos de Comisiones

### 1. Ecommerce Earnings (%) - Ganancia Personal del Vendedor

**Campo en Admin:** "Ecommerce Earnings %"  
**Campo en DB:** `phase_levels.commission_rate`  
**Servicio:** `SellerCommissionService`  
**Requiere Suscripción:** ✅ SÍ

**Cómo funciona:**
- El vendedor recibe un porcentaje de las ventas en su tienda de afiliado
- El porcentaje depende de su fase (8%, 15%, 30%, 40%)
- Se deposita directamente en su wallet
- Este es el campo que se muestra como "Ecommerce Earnings %" en el admin

**Ejemplo:**
```
Usuario A (Vendedor - Phase 2)
Ecommerce Earnings: 30%

Usuario B compra $100 en la tienda de Usuario A

RESULTADO:
✅ Usuario A recibe: $100 × 30% = $30.00 en su wallet
```

**NOTA IMPORTANTE:** Este campo anteriormente se mostraba como "Network / Upline %" en el admin, 
pero se renombró a "Ecommerce Earnings %" para reflejar su uso real. NO controla las comisiones 
de la red/upline, solo la ganancia del vendedor de su propia tienda.

### 2. Direct Sponsor Commission (%) - Comisión del Patrocinador Directo

**Campo en Admin:** "Direct Sponsor %"  
**Campo en DB:** `phase_levels.affiliate_sponsor_commission_rate`  
**Servicio:** `CommissionCalculatorService`  
**Requiere Suscripción:** ✅ SÍ

**Cómo funciona:**
- El patrocinador directo recibe un porcentaje de las ventas de su referido
- El porcentaje depende de la fase del vendedor (no del patrocinador)
- Solo aplica para ventas en tiendas de afiliado
- Se guarda en `network_commissions`

**Ejemplo:**
```
Usuario A (Patrocinador)
Usuario B (Vendedor - Phase 2, Direct Sponsor: 10%)

Usuario C compra $100 en la tienda de Usuario B

RESULTADO:
✅ Usuario B recibe: $100 × 30% = $30.00 (Ecommerce Earnings)
✅ Usuario A recibe: $100 × 10% = $10.00 (Direct Sponsor Commission)
```

### 3. Group Gain (%) - Ganancia de Grupo para Patrocinadores (DEPRECADO)

**Campo en Admin:** N/A (ya no se usa)  
**Campo en DB:** `phase_levels.subscription_discount_rate`  
**Servicio:** `CommissionCalculatorService` (código legacy)  
**Requiere Suscripción:** ✅ SÍ

**NOTA:** Este campo ya no se utiliza activamente en el sistema. 
Las comisiones de red ahora se manejan exclusivamente con "Direct Sponsor %".

**Ejemplo:**
```
Usuario A (Phase 2, Group Gain: 15%, Nivel 2)
Usuario B (Phase 1, Group Gain: 10%, Nivel 1)
Usuario C (Comprador) compra $100

RESULTADO:
✅ Usuario B recibe: $15 (base) + $10 (group gain) = $25.00
✅ Usuario A recibe: $10 (base) + $15 (group gain) = $25.00
```

### 3. Comisiones MLM (Multinivel) - REMOVIDAS

**NOTA:** Las comisiones basadas en "Level Earnings" han sido eliminadas del sistema.
Anteriormente, estas comisiones otorgaban montos fijos por cada compra o pago de suscripción en la red.
Esta funcionalidad ya no está disponible.

**Tipos de comisiones que permanecen activas:**
- Ecommerce Earnings (comisiones de vendedor)
- Group Gain (comisiones de patrocinador por ventas de afiliados)

### 4. Comisiones por Suscripción - REMOVIDAS

**NOTA:** Las comisiones por pago de suscripción basadas en "Level Earnings" han sido eliminadas.
Esta funcionalidad ya no genera comisiones para la red de patrocinadores.

Red de Juan:
├── María (Nivel 1, ✅ activa, 2/5 miembros) → Recibe $15.00
├── Carlos (Nivel 2, ✅ activo, 8/25 miembros) → Recibe $10.00
├── Ana (Nivel 3, ❌ inactiva) → No recibe comisión
└── Luis (Nivel 4, ✅ activo) → No recibe (cadena rota)

Total generado: $25.00 en comisiones
```

## Configuración en App Settings

### Campos Configurables

```typescript
{
  // Ecommerce Earnings - Porcentaje para vendedores
  ecommerceCommissionRate: 0.08, // 8% para comisiones de e-commerce
  
  // Maximum Members - Límite de miembros por nivel
  maxMembersPerLevel: [
    { level: 1, maxMembers: 5 },     // Máximo 5 referidos directos
    { level: 2, maxMembers: 25 },    // Máximo 25 miembros de nivel 2
    { level: 3, maxMembers: 125 },   // Máximo 125 miembros de nivel 3
    { level: 4, maxMembers: 625 },   // Máximo 625 miembros de nivel 4
    { level: 5, maxMembers: 3125 },  // Máximo 3125 miembros de nivel 5
  ],
  
  // Phase Levels - Configuración por fase
  phaseLevels: [
    { phase: 0, commission_rate: 0.08, subscription_discount_rate: 0.00 },
    { phase: 1, commission_rate: 0.15, subscription_discount_rate: 0.10 },
    { phase: 2, commission_rate: 0.30, subscription_discount_rate: 0.15 },
    { phase: 3, commission_rate: 0.40, subscription_discount_rate: 0.20 },
  ]
}
```

## Requisitos para Recibir Comisiones

### Ecommerce Earnings (Vendedor)
- ✅ Tener tienda de afiliado activa
- ✅ Tener suscripción activa (`status = 'active'`, `waitlisted = false`)
- ✅ La venta debe ser a través de su tienda de afiliado
- ✅ Metadata debe incluir `affiliateId` y `saleChannel: 'affiliate_store'`

### Group Gain (Patrocinadores)
- ✅ Tener suscripción activa (`status = 'active'`, `waitlisted = false`)
- ✅ La venta debe ser a través de una tienda de afiliado
- ✅ Estar en la cadena de patrocinadores del comprador

### Comisiones MLM (Multinivel)
- ✅ Tener suscripción activa (`status = 'active'`, `waitlisted = false`)
- ✅ Estar en la cadena de patrocinadores del comprador
- ✅ No haber alcanzado el límite de `maxMembersPerLevel`

### Comisiones por Suscripción
- ✅ Tener suscripción activa (`status = 'active'`, `waitlisted = false`)
- ✅ Estar en la cadena de patrocinadores del usuario que pagó
- ✅ No haber alcanzado el límite de `maxMembersPerLevel`

## Flujo de Procesamiento

### Cuando se procesa un pago:

```
1. Se detecta metadata de la orden
   ├─ affiliateId: "uuid-del-vendedor"
   └─ saleChannel: "affiliate_store"

2. SellerCommissionService (Ecommerce Earnings)
   ├─ Obtiene fase del vendedor
   ├─ Obtiene commission_rate de phase_levels
   ├─ Calcula: totalCents × commission_rate
   ├─ Verifica suscripción activa del vendedor
   └─ Agrega fondos al wallet del vendedor

3. CommissionCalculatorService (MLM + Group Gain)
   ├─ Obtiene cadena de patrocinadores
   ├─ Para cada patrocinador:
   │   ├─ Verifica suscripción activa
   │   ├─ Verifica límite de miembros
   │   ├─ Calcula comisión base (levelEarnings)
   │   ├─ Calcula Group Gain (totalCents × subscriptionDiscountRate)
   │   ├─ Suma: base + groupGain
   │   └─ Guarda en network_commissions
   └─ Retorna comisiones creadas
```

### Cuando se paga una suscripción:

```
1. Usuario paga suscripción → Stripe/PayPal procesa el pago
2. Sistema actualiza suscripción → status cambia a 'active'
3. Evento disparado → subscription.updated se emite
4. SubscriptionCommissionService procesa:
   ├─ Obtiene cadena de patrocinadores
   ├─ Para cada patrocinador:
   │   ├─ Verifica suscripción activa
   │   ├─ Verifica límite de miembros
   │   ├─ Calcula comisión (levelEarnings)
   │   └─ Guarda en network_commissions
   └─ Retorna comisiones creadas
```

## Estructura de Datos

### Wallet Transaction (Ecommerce Earnings)

```json
{
  "id": "uuid",
  "user_id": "vendedor-uuid",
  "amount_cents": 3000,
  "type": "sale_commission",
  "description": "Ecommerce commission from affiliate store sale",
  "metadata": {
    "source": "affiliate_store_sale",
    "commission_rate": 0.30,
    "sale_total_cents": 10000,
    "seller_phase": 2,
    "order_id": "order-uuid"
  }
}
```

### Network Commission (MLM + Group Gain)

```json
{
  "id": "uuid",
  "user_id": "patrocinador-uuid",
  "member_id": "comprador-uuid",
  "level": 1,
  "amount_cents": 2500,
  "available_cents": 2500,
  "metadata": {
    "base_commission_cents": 1500,
    "sale_total_cents": 10000,
    "group_gain_cents": 1000,
    "group_gain_rate": 0.10,
    "group_gain_origin": "affiliate_store",
    "affiliate_id": "vendedor-uuid",
    "order_id": "order-uuid"
  }
}
```

### Network Commission (Suscripción)

```json
{
  "id": "uuid",
  "user_id": "patrocinador-uuid",
  "member_id": "usuario-que-pago-uuid",
  "level": 1,
  "amount_cents": 1500,
  "available_cents": 1500,
  "metadata": {
    "commission_type": "subscription_payment",
    "subscription_period": "2025-01"
  }
}
```

## Tabla Comparativa

| Aspecto | Ecommerce Earnings | Group Gain | MLM Compras | MLM Suscripción |
|---------|-------------------|------------|-------------|-----------------|
| **Quién lo recibe** | Dueño de la tienda | Patrocinadores | Patrocinadores | Patrocinadores |
| **Cuándo se aplica** | Venta en tienda afiliado | Venta en tienda afiliado | Cualquier compra | Pago de suscripción |
| **Dónde se guarda** | `wallet_transactions` | `network_commissions` | `network_commissions` | `network_commissions` |
| **Tipo de monto** | Porcentaje | Porcentaje | Fijo | Fijo |
| **Campo en DB** | `commission_rate` | `subscription_discount_rate` | `levelEarnings` | `levelEarnings` |
| **Requiere suscripción** | ✅ SÍ | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| **Servicio** | `SellerCommissionService` | `CommissionCalculatorService` | `CommissionCalculatorService` | `SubscriptionCommissionService` |

## Límites de Miembros por Nivel

### Cómo Funcionan

El sistema respeta la configuración de `maxMembersPerLevel`:

1. **Conteo de Miembros Activos**: Para cada sponsor, cuenta cuántos miembros activos tiene en cada nivel
2. **Verificación de Límites**: Antes de crear una comisión, verifica si el sponsor ha alcanzado el límite
3. **Aplicación de Límites**: Solo los primeros N miembros (según configuración) generan comisiones

### Ejemplo

```typescript
// Configuración: Máximo 3 referidos directos
maxMembersPerLevel: [{ level: 1, maxMembers: 3 }]

// Escenario: María tiene 4 referidos directos
María (sponsor)
├── Juan (1er referido) ✅ Paga suscripción → María recibe comisión
├── Pedro (2do referido) ✅ Paga suscripción → María recibe comisión
├── Ana (3er referido) ✅ Paga suscripción → María recibe comisión
└── Luis (4to referido) ❌ Paga suscripción → María NO recibe (límite alcanzado)
```

## Archivos del Sistema

### Servicios
- `src/modules/multilevel/services/seller-commission-service.ts` - Ecommerce Earnings
- `src/modules/multilevel/services/commission-calculator-service.ts` - MLM + Group Gain
- `src/modules/multilevel/services/subscription-commission-service.ts` - Comisiones por suscripción
- `src/modules/multilevel/services/wallet-service.ts` - Gestión de wallet

### Configuración
- `src/app/admin/app-settings/app-settings-form.tsx` - UI de configuración
- `src/modules/phase-levels/domain/models/phase-level.ts` - Modelo de datos
- `src/lib/helpers/settings-helper.ts` - Helpers para obtener rates

### Integración
- `src/app/api/payments/wallet/charge/route.ts` - Procesa pagos con wallet
- `src/app/api/webhooks/stripe/route.ts` - Procesa pagos con Stripe
- `src/app/api/webhooks/paypal/route.ts` - Procesa pagos con PayPal

## Verificación SQL

### Ver Ecommerce Earnings
```sql
SELECT 
  wt.id,
  wt.user_id,
  wt.amount_cents / 100.0 as amount_dollars,
  wt.metadata->>'commission_rate' as rate,
  wt.metadata->>'sale_total_cents' as sale_total,
  wt.created_at
FROM wallet_transactions wt
WHERE wt.metadata->>'source' = 'affiliate_store_sale'
ORDER BY wt.created_at DESC;
```

### Ver Group Gain
```sql
SELECT 
  nc.id,
  nc.user_id,
  nc.level,
  nc.amount_cents / 100.0 as total_dollars,
  nc.metadata->>'base_commission_cents' as base,
  nc.metadata->>'group_gain_cents' as group_gain,
  nc.created_at
FROM network_commissions nc
WHERE nc.metadata->>'group_gain_origin' = 'affiliate_store'
ORDER BY nc.created_at DESC;
```

### Ver Comisiones por Suscripción
```sql
SELECT 
  nc.id,
  nc.user_id,
  nc.level,
  nc.amount_cents / 100.0 as amount_dollars,
  nc.metadata->>'subscription_period' as period,
  nc.created_at
FROM network_commissions nc
WHERE nc.metadata->>'commission_type' = 'subscription_payment'
ORDER BY nc.created_at DESC;
```

## Troubleshooting

### Las comisiones no aparecen

1. **Verifica suscripción activa:**
   ```sql
   SELECT status, waitlisted
   FROM subscriptions
   WHERE user_id = 'sponsor-user-id';
   ```
2. Si `status != 'active'` o `waitlisted = true`, el sponsor NO recibirá comisiones
3. Verifica que el usuario tiene un `referred_by` o `sponsor_id`
4. Revisa los logs del servidor para errores

### Los montos no coinciden con app-settings

1. Verifica que guardaste los cambios en app-settings
2. Las comisiones ya creadas no se actualizan automáticamente
3. Solo las nuevas compras usan la configuración actualizada

### Un sponsor no recibe comisiones

1. Verifica su estado de suscripción
2. Verifica si alcanzó el límite de `maxMembersPerLevel`
3. Verifica que está en la cadena de patrocinadores

## Referencias

- **Documentación técnica**: `docs/commission-system.md`
- **Ejemplos de código**: `docs/examples/ecommerce-earnings-example.ts`
- **Migraciones**: `docs/migrations/`

