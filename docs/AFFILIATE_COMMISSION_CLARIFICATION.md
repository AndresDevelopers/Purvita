# Aclaración: Campos de Comisión en Admin Affiliates

## Problema Identificado

En la página de admin `/admin/affiliates`, había un campo **"Network / Upline %"** que NO debería estar ahí.

## Análisis

### ¿Qué hace cada campo?

#### 1. **Direct Sponsor %** ✅ (Correcto - debe estar en /admin/affiliates)
- **Campo DB:** `phase_levels.affiliate_sponsor_commission_rate`
- **Propósito:** Controla cuánto gana el patrocinador directo cuando su referido hace una venta
- **Ejemplo:** Si está en 10%, y tu referido vende $100, tú ganas $10
- **Pertenece a:** Configuración de red/affiliates

#### 2. **Ecommerce Earnings %** ❌ (Incorrecto - NO debe estar en /admin/affiliates)
- **Campo DB:** `phase_levels.commission_rate`
- **Propósito:** Controla cuánto gana el VENDEDOR de su propia tienda de afiliado
- **Ejemplo:** Si estás en Fase 2 (30%), y vendes $100, tú ganas $30
- **Pertenece a:** Configuración de fases/vendedores (debería estar en /admin/phase-levels)

## Cambios Realizados

### 1. Eliminado el campo "Ecommerce Earnings %" de /admin/affiliates
```diff
- Sección: "Phase Commissions" con 2 campos (Direct Sponsor % y Network/Upline %)
+ Sección: "Direct Sponsor Commission by Phase" con 1 campo (Direct Sponsor %)
```

### 2. Actualización de Descripción
```diff
- "Configure earnings for each phase. 'Sponsor %' is for the direct referrer. 'Network %' is for upline distribution."
+ "Configure how much the direct sponsor earns when their referral makes a sale. The percentage is based on the seller's phase level."
```

## ¿Por qué el cambio?

El campo "Network / Upline %" (Ecommerce Earnings) NO debería estar en `/admin/affiliates` porque:

1. **No es una configuración de red/affiliates** - Es una configuración de ganancia personal del vendedor
2. **Ya existe "Direct Sponsor %"** - Que sí es una configuración de red/affiliates
3. **Confusión de propósito** - La página de affiliates debe configurar solo comisiones de red, no ganancias personales
4. **Ubicación incorrecta** - Este campo debería estar en `/admin/phase-levels` o una sección de "Seller Settings"

## Flujo de Comisiones Actual

```
Venta de $100 en tienda de afiliado (Vendedor en Fase 2)

┌─────────────────────────────────────────┐
│ Comprador paga $100                     │
└─────────────────────────────────────────┘
                 │
                 ├──> Vendedor (Ecommerce Earnings 30%)
                 │    Recibe: $30.00 en wallet
                 │
                 └──> Patrocinador Directo (Direct Sponsor 10%)
                      Recibe: $10.00 en network_commissions
```

## Seguridad y Permisos

La página `/admin/affiliates` está protegida con:

### 1. AdminGuard Component
- **Verificación de autenticación:** Usuario debe estar logueado
- **Permiso de acceso al panel:** `access_admin_panel` (requerido)
- **Permiso específico:** `manage_settings` (requerido)

### 2. Flujo de Verificación
```typescript
// src/app/admin/affiliates/page.tsx
<AdminGuard lang={lang} requiredPermission="manage_settings">
  <AdminAffiliatesPageContent lang={lang} />
</AdminGuard>
```

### 3. Endpoints Protegidos
- `GET /api/check-admin-access` - Verifica acceso al panel de admin
- `POST /api/admin/check-permission` - Verifica permiso específico
- `PUT /api/admin/app-settings` - Requiere autenticación y permisos
- `PUT /api/admin/phase-levels/:id` - Requiere autenticación y permisos

## Archivos Modificados

1. **`src/app/admin/affiliates/affiliate-settings-form.tsx`**
   - Eliminado campo "Ecommerce Earnings %" (commission_rate)
   - Eliminado estado `phaseNetworkRates`
   - Eliminado handler `handleNetworkRateChange`
   - Simplificado guardado para solo actualizar `affiliateSponsorCommissionRate`
   - Actualizada descripción de la sección

2. **`docs/commission-system.md`**
   - Actualizada documentación de tipos de comisiones
   - Agregada nota sobre Direct Sponsor Commission

3. **`docs/AFFILIATE_COMMISSION_CLARIFICATION.md`** (este archivo)
   - Nueva documentación explicativa

## Uso en el Código

### Ecommerce Earnings (commission_rate)
```typescript
// src/lib/helpers/settings-helper.ts
export async function getPhaseCommissionRate(phase: number): Promise<number> {
  const phaseLevels = await getCachedPhaseLevels();
  const phaseLevel = phaseLevels.find(p => p.level === phase);
  return phaseLevel.commissionRate; // <-- Este campo
}

// src/modules/multilevel/services/seller-commission-service.ts
const commissionRate = await getPhaseCommissionRate(sellerPhase);
const commissionCents = Math.round(totalCents * commissionRate);
// Se deposita en wallet del vendedor
```

### Direct Sponsor Commission (affiliate_sponsor_commission_rate)
```typescript
// Este campo se usa en CommissionCalculatorService
// pero actualmente el código usa subscriptionDiscountRate (Group Gain)
// que es un campo legacy que debería migrarse a affiliate_sponsor_commission_rate
```

## Recomendaciones Futuras

1. **Migrar de Group Gain a Direct Sponsor**
   - Actualmente el código usa `subscriptionDiscountRate` (Group Gain)
   - Debería migrar a usar `affiliateSponsorCommissionRate` (Direct Sponsor)
   - Esto haría el sistema más consistente

2. **Eliminar campos deprecados**
   - `app_settings.directSponsorCommissionRate` (ya no se usa)
   - `app_settings.networkCommissionRate` (ya no se usa)
   - `phase_levels.subscription_discount_rate` (legacy, migrar a affiliate_sponsor_commission_rate)

## Preguntas Frecuentes

### ¿Se eliminó alguna funcionalidad?
No. El campo `commission_rate` sigue existiendo en la base de datos y se sigue usando en el código. Solo se eliminó de la UI de `/admin/affiliates` porque no pertenece ahí.

### ¿Dónde configuro ahora el "Ecommerce Earnings %"?
Actualmente, este campo debe configurarse en `/admin/phase-levels` o mediante la API directamente. Se recomienda agregar una sección dedicada en el admin para configurar este campo.

### ¿Afecta a las comisiones existentes?
No. El cambio es solo en la UI del admin. Las comisiones siguen funcionando igual.

### ¿Necesito actualizar algo en producción?
No. El cambio es backward-compatible y no afecta la funcionalidad existente.

### ¿Por qué solo queda Direct Sponsor % en /admin/affiliates?
Porque `/admin/affiliates` debe configurar solo las comisiones de red/patrocinadores. Las ganancias personales del vendedor (Ecommerce Earnings) no son parte de la configuración de affiliates.

## Referencias

- Sistema de Comisiones: `docs/commission-system.md`
- Código de Seller Commission: `src/modules/multilevel/services/seller-commission-service.ts`
- Código de Network Commission: `src/modules/multilevel/services/commission-calculator-service.ts`
