# Valores del Dashboard - Origen de Datos

Este documento explica de dónde provienen todos los valores mostrados en el dashboard del usuario.

## Sección: Cards Principales

### 1. Phase (Fase)
- **Origen**: `summary.phase.phase` (tabla `phases`)
- **Tipo**: Número entero (0-3)
- **Lógica**: Calculado por la función SQL `recalculate_phase` basado en:
  - Phase 0: Suscripción activa
  - Phase 1: 2+ referidos directos activos
  - Phase 2: 4+ referidos de segundo nivel (mín. 2 por cada directo)
  - Phase 3: Requisitos de Phase 2 + criterios adicionales

### 2. Commission Rate (Tasa de Comisión)
- **Origen**: `summary.phase.ecommerce_commission` (tabla `phases`)
- **Sincronizado con**: `profiles.commission_rate`
- **Tipo**: Decimal (0.00 - 1.00), mostrado como porcentaje
- **Valores por defecto**:
  - Phase 0: 8% (0.08)
  - Phase 1: 10% (0.10)
  - Phase 2: 12% (0.12)
  - Phase 3: 15% (0.15)
- **Personalización**: El admin puede configurar un valor personalizado que persiste

### 3. Wallet Balance (Saldo de Billetera)
- **Origen**: `summary.wallet.balance_cents` (tabla `wallet`)
- **Tipo**: Número entero en centavos
- **Formato**: Convertido a moneda con `formatCurrency()`

### 4. Subscription Status (Estado de Suscripción)
- **Origen**: `summary.subscription.status` (tabla `subscriptions`)
- **Valores posibles**: 
  - `active`: Activa
  - `past_due`: Pago vencido
  - `unpaid`: Sin pagar
  - `canceled`: Cancelada
- **Fecha de próximo cargo**: `summary.subscription.current_period_end`

## Sección: Earnings Overview

### Current Balance
- **Origen**: `summary.wallet.balance_cents`
- **Mismo valor que el card de Wallet**

### Commission Rate
- **Origen**: `summary.phase.ecommerce_commission`
- **Mismo valor que el card de Commission**
- **Condición**: Solo se muestra si `hasActiveSubscription === true`

### Monthly Subscription
- **Origen**: `planPrice` (obtenido de `getPlans()`)
- **Lógica**: Se obtiene el plan con el precio más bajo
- **Tipo**: Número decimal, convertido a centavos para mostrar

## Sección: Progress (Progreso)

### Level 1 Referrals
- **Origen**: `summary.level1Count`
- **Calculado por**: RPC `count_active_level(p_user, 1)`
- **Target**: 2 (hardcoded en `TARGET_LEVEL1`)
- **Lógica**: Cuenta referidos directos con suscripción activa

### Level 2 Referrals
- **Origen**: `summary.level2Count`
- **Calculado por**: RPC `count_active_level(p_user, 2)`
- **Target**: 4 (hardcoded en `TARGET_LEVEL2`)
- **Lógica**: Cuenta referidos de segundo nivel con suscripción activa

## Sección: Network Overview

### Total Team Members
- **Origen**: Calculado como `level1Count + level2Count`
- **Tipo**: Suma de referidos de nivel 1 y 2

### Level 1 Referrals
- **Origen**: `summary.level1Count`

### Level 2 Referrals
- **Origen**: `summary.level2Count`

## Sección: Unlocked Benefits (Beneficios Desbloqueados)

### Plan Phases
- **Origen**: Diccionario de traducciones `dict.teams.plan.phases`
- **Filtrado por**: `currentPhase` del usuario
- **Contenido**: 
  - Requirements (Requisitos)
  - Rewards (Recompensas)
- **Precio dinámico**: Los textos con `$XX` se reemplazan con `planPrice`

## Valores Hardcodeados

### En el Dashboard
- `TARGET_LEVEL1 = 2`: Requisito para Phase 1
- `TARGET_LEVEL2 = 4`: Requisito para Phase 2

### En la Base de Datos (función recalculate_phase)
- Requisito Phase 1: `direct_active_count >= 2`
- Requisito Phase 2: `second_level_total >= 4 AND min_second_level >= 2`
- Requisito Phase 3: `direct_active_count >= 2 AND min_second_level >= 2`
- Comisiones por defecto: 0.08, 0.10, 0.12, 0.15

## Endpoint API

Todos los datos del dashboard se obtienen de:
- **Endpoint**: `/api/dashboard/summary`
- **Método**: GET
- **Header requerido**: `x-user-id`
- **Servicio**: `DashboardSummaryService.getSummary(userId)`

## Flujo de Datos

```
Usuario → Dashboard Component
         ↓
    /api/dashboard/summary
         ↓
    DashboardSummaryService
         ↓
    ┌─────────────────────────────┐
    │ PhaseRepository             │ → phases table
    │ SubscriptionRepository      │ → subscriptions table
    │ WalletRepository            │ → wallet table
    │ count_active_level RPC (x2) │ → profiles + subscriptions
    └─────────────────────────────┘
         ↓
    SubscriptionSummary
         ↓
    Dashboard UI (formatted)
```

## Recomendaciones

1. **Targets de nivel**: Considerar mover `TARGET_LEVEL1` y `TARGET_LEVEL2` a la configuración de la aplicación (`app_settings`)
2. **Comisiones por defecto**: Considerar mover las comisiones por defecto de cada fase a `app_settings`
3. **Validación**: Asegurar que `commission_rate` personalizado no se sobrescriba al recalcular fase (ya implementado en la migración)


## Actualización: Reemplazo Dinámico de Precios

### Cambio Implementado

El dashboard ahora reemplaza correctamente todos los valores hardcodeados de $34 con el precio real del plan configurado.

**Antes**:
```typescript
.replace(/\$\d+/, `${planPrice.toFixed(2)}`)
```
- Solo reemplazaba la primera ocurrencia
- No incluía el símbolo $ en el reemplazo
- No soportaba precios con decimales

**Ahora**:
```typescript
.replace(/\$\d+(\.\d{2})?/g, `$${planPrice.toFixed(2)}`)
```
- Reemplaza todas las ocurrencias (flag `g`)
- Incluye el símbolo $ en el reemplazo
- Soporta precios con y sin decimales ($34 o $34.99)

### Ubicaciones Actualizadas

1. **Commission Card (locked state)**: Línea 417
   - Texto: "Confirm your $34 membership payment..."
   - Ahora muestra: "Confirm your $XX.XX membership payment..."

2. **Phase Summary Cards**: Función `processRewardText` (línea 582)
   - Reemplaza $34 en requirements y rewards
   - Aplica a todas las fases desbloqueadas

### Ejemplo de Uso

Si el plan configurado cuesta $49.99:
- "Confirm your $34 subscription" → "Confirm your $49.99 subscription"
- "Activate your account with the $34 monthly fee" → "Activate your account with the $49.99 monthly fee"
- "2 subscriptions × $34" → "2 subscriptions × $49.99"
