# Comisiones de Sponsor para Afiliados

## Resumen

Este documento describe el sistema de comisiones para sponsors cuando un afiliado realiza una venta.

## Conceptos Clave

### Tipos de Usuarios

1. **Afiliado**: Usuario con suscripción de afiliado (no MLM). Puede estar en cualquier nivel sin límites.
2. **MLM Subscriber**: Usuario con suscripción MLM. Tiene límites de red configurados en app settings.

### Tipos de Sponsors

1. **Sponsor Directo**: La persona que refirió directamente al afiliado.
   - Ejemplo: Pedro refirió a María → Pedro es el sponsor directo de María.

2. **Sponsor General**: La persona que inició la red MLM (el "fundador" de la línea).
   - Ejemplo: Kevin inició la red, Pedro se unió a través de Kevin, María se unió a través de Pedro.
   - Kevin es el sponsor general de María.

## Configuración en Admin

### Página: `/admin/affiliates`

#### Sección 1: Store Owner Profit
- Configura el descuento/ganancia del dueño de tienda.

#### Sección 2: Affiliate Sponsor Commissions
Comisiones para sponsors cuando un **afiliado sin suscripción MLM** hace una venta:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| Direct Sponsor % | Comisión para el sponsor directo | 5% |
| General Sponsor % | Comisión para el sponsor general | 2% |

**Ejemplo de cálculo:**
- María (afiliada) vende $100
- Pedro (sponsor directo) recibe: $100 × 5% = $5
- Kevin (sponsor general) recibe: $100 × 2% = $2

#### Sección 3: MLM Subscription - Phase Commissions
Comisiones para sponsors cuando un **suscriptor MLM** hace una venta:
- Configuradas por fase (nivel 1+)
- Solo aplica a usuarios con suscripción MLM activa
- Los límites de red se configuran en app settings

## Diferencias: Afiliado vs MLM

| Característica | Afiliado | MLM Subscriber |
|----------------|----------|----------------|
| Límites de red | Sin límites | Configurados en app settings |
| Comisiones sponsor | Global (app_settings) | Por fase (phase_levels) |
| Fases | No aplica | Fase 1+ forma la red |

## Campos en Base de Datos

### Tabla: `app_settings`
```sql
affiliate_direct_sponsor_commission_rate numeric DEFAULT 0.05
affiliate_general_sponsor_commission_rate numeric DEFAULT 0.02
```

### Tabla: `phase_levels`
```sql
affiliate_sponsor_commission_rate numeric DEFAULT 0
```

## Flujo de Comisiones

```
Venta de $100 por un Afiliado (María)
┌─────────────────────────────────────────┐
│ Comprador paga $100                     │
└─────────────────────────────────────────┘
                 │
                 ├──> María (Afiliada)
                 │    Recibe: $10 (10% affiliate_commission_rate)
                 │
                 ├──> Pedro (Sponsor Directo)
                 │    Recibe: $5 (5% affiliate_direct_sponsor_commission_rate)
                 │
                 └──> Kevin (Sponsor General)
                      Recibe: $2 (2% affiliate_general_sponsor_commission_rate)
```

## Migración

Ejecutar el script SQL:
```
docs/verified/20250525_affiliate_sponsor_commissions.sql
```

Este script:
1. Agrega los nuevos campos a `app_settings`
2. Migra datos existentes de `affiliate_referrer_commission_rate`
3. Establece valores por defecto

## Archivos Modificados

1. `src/modules/app-settings/domain/models/app-settings.ts` - Schema y tipos
2. `src/modules/app-settings/data/repositories/supabase-app-settings-repository.ts` - Mapeo DB
3. `src/app/admin/affiliates/affiliate-settings-form.tsx` - UI del admin
4. `src/app/api/public/mlm-config/route.ts` - API pública
5. `src/app/components/income-calculator.tsx` - Calculadora de ingresos
6. `docs/database/database.sql` - Schema principal
