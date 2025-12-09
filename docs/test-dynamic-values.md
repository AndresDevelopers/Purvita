# Pruebas de Valores Dinámicos en Landing Page

## Descripción

Este documento describe cómo probar que todos los valores de $ y % en la landing page son dinámicos y se configuran desde la tabla `phase_levels`.

## Pre-requisitos

1. ✅ Migración aplicada: `docs/database/migrations/add_phase_levels_landing_fields.sql`
2. ✅ Servidor de desarrollo corriendo: `npm run dev`
3. ✅ Acceso a la base de datos Supabase (developer)

## Valores Dinámicos Implementados

### Por Fase

Cada fase ahora obtiene sus valores desde `phase_levels`:

| Campo | Origen | Ejemplo |
|-------|--------|---------|
| **Título** | `name_en` / `name_es` | "Phase 0 · Registration" |
| **Descriptor** | `descriptor_en` / `descriptor_es` | "Access the business toolkit..." |
| **Requisito** | `requirement_en` / `requirement_es` | "Activate your account..." |
| **Inversión Mensual** | Calculado desde `monthlyFeeAmount` | "Monthly commitment: $34" |
| **Rewards** | `rewards_en` / `rewards_es` con tokens | ["Choose one free product (valued at $65)"] |
| **Comisión** | `commission_rate` | "E-commerce commission: 8% per sale" |
| **Crédito de Billetera** | `credit_cents` | "Wallet balance after Phase 1: $3" |
| **Visibility Tag** | `visibility_tag_en` / `visibility_tag_es` | "VISIBLE" |

### Tokens Dinámicos

Los siguientes tokens se reemplazan automáticamente:

- `{{price}}` → Precio de suscripción mensual
- `{{freeProductValue}}` → Valor del producto gratis (de `free_product_value_cents`)
- `{{walletCredit}}` → Crédito de billetera (de `credit_cents`)
- `{{commissionRate}}` → Porcentaje de comisión (de `commission_rate`)

## Escenarios de Prueba

### Escenario 1: Cambiar Porcentaje de Comisión

**Objetivo**: Verificar que el % de comisión se actualiza dinámicamente

**Setup:**
```sql
-- Cambiar comisión de Phase 0 de 8% a 10%
UPDATE phase_levels
SET commission_rate = 0.10
WHERE level = 0;
```

**Verificación:**
1. Recargar la landing page: http://localhost:3000/en
2. Buscar Phase 0 en la sección Opportunity
3. Verificar que muestre: "E-commerce commission: 10% per sale"

**Rollback:**
```sql
UPDATE phase_levels SET commission_rate = 0.08 WHERE level = 0;
```

---

### Escenario 2: Cambiar Valor del Producto Gratis

**Objetivo**: Verificar que el valor del producto gratis se actualiza en los rewards

**Setup:**
```sql
-- Cambiar valor de producto gratis de Phase 1 de $65 a $100
UPDATE phase_levels
SET free_product_value_cents = 10000
WHERE level = 1;
```

**Verificación:**
1. Recargar la landing page
2. Buscar Phase 1
3. Verificar que el reward muestre: "Choose one free product (valued at $100)"

**Rollback:**
```sql
UPDATE phase_levels SET free_product_value_cents = 6500 WHERE level = 1;
```

---

### Escenario 3: Cambiar Crédito de Billetera

**Objetivo**: Verificar que el crédito de billetera se actualiza

**Setup:**
```sql
-- Cambiar crédito de Phase 2 de $125 a $150
UPDATE phase_levels
SET credit_cents = 15000
WHERE level = 2;
```

**Verificación:**
1. Recargar la landing page
2. Buscar Phase 2
3. Verificar que muestre:
   - En rewards: "$150 wallet balance credit"
   - En account balance highlight: "Wallet balance after Phase 2: $150"

**Rollback:**
```sql
UPDATE phase_levels SET credit_cents = 12500 WHERE level = 2;
```

---

### Escenario 4: Cambiar Descriptor de Fase

**Objetivo**: Verificar que el texto descriptivo se actualiza

**Setup:**
```sql
-- Cambiar descriptor de Phase 0
UPDATE phase_levels
SET descriptor_en = 'Get instant access to our complete business toolkit and start earning today!',
    descriptor_es = '¡Obtén acceso instantáneo a nuestro kit completo de negocios y comienza a ganar hoy!'
WHERE level = 0;
```

**Verificación:**
1. Recargar la landing page en inglés
2. Verificar que Phase 0 muestre el nuevo descriptor
3. Cambiar a español: http://localhost:3000/es
4. Verificar que muestre el descriptor en español

**Rollback:**
```sql
UPDATE phase_levels
SET descriptor_en = 'Access the business toolkit as soon as you complete your registration.',
    descriptor_es = 'Accede al kit de herramientas de negocio tan pronto como completes tu registro.'
WHERE level = 0;
```

---

### Escenario 5: Cambiar Rewards

**Objetivo**: Verificar que los rewards se actualizan dinámicamente

**Setup:**
```sql
-- Cambiar rewards de Phase 1
UPDATE phase_levels
SET rewards_en = ARRAY[
  'Free product worth ${{freeProductValue}}',
  '${{walletCredit}} instant wallet credit',
  'Priority customer support',
  'Exclusive training materials'
],
rewards_es = ARRAY[
  'Producto gratis por valor de ${{freeProductValue}}',
  '${{walletCredit}} crédito instantáneo en billetera',
  'Soporte prioritario al cliente',
  'Materiales de capacitación exclusivos'
]
WHERE level = 1;
```

**Verificación:**
1. Recargar la landing page
2. Verificar que Phase 1 muestre 4 rewards
3. Verificar que los tokens se reemplacen correctamente
4. Cambiar a español y verificar

**Rollback:**
```sql
UPDATE phase_levels
SET rewards_en = ARRAY[
  'Choose one free product (valued at ${{freeProductValue}})',
  'Receive a ${{walletCredit}} wallet balance credit'
],
rewards_es = ARRAY[
  'Elige un producto gratis (valorado en ${{freeProductValue}})',
  'Recibe un crédito de ${{walletCredit}} en tu billetera'
]
WHERE level = 1;
```

---

### Escenario 6: Cambiar Visibility Tag

**Objetivo**: Verificar que el badge de visibilidad se actualiza

**Setup:**
```sql
-- Cambiar visibility tag de Phase 1
UPDATE phase_levels
SET visibility_tag_en = 'POPULAR',
    visibility_tag_es = 'POPULAR'
WHERE level = 1;
```

**Verificación:**
1. Recargar la landing page
2. Verificar que Phase 1 muestre el badge "POPULAR" en lugar de "VISIBLE"

**Rollback:**
```sql
UPDATE phase_levels
SET visibility_tag_en = 'VISIBLE',
    visibility_tag_es = 'VISIBLE'
WHERE level = 1;
```

---

### Escenario 7: Múltiples Cambios Simultáneos

**Objetivo**: Verificar que múltiples cambios se reflejan correctamente

**Setup:**
```sql
-- Actualizar Phase 3 completamente
UPDATE phase_levels
SET 
  commission_rate = 0.50,
  credit_cents = 30000,
  free_product_value_cents = 25000,
  descriptor_en = 'Reach the pinnacle of our opportunity plan with maximum rewards!',
  requirement_en = 'Maintain 3 active levels for two consecutive billing cycles.',
  rewards_en = ARRAY[
    'Free products worth ${{freeProductValue}}',
    '${{walletCredit}} monthly wallet credit',
    'VIP customer support',
    'Exclusive leadership training'
  ],
  visibility_tag_en = 'ELITE'
WHERE level = 3;
```

**Verificación:**
1. Recargar la landing page
2. Verificar Phase 3:
   - Badge: "ELITE"
   - Descriptor: nuevo texto
   - Requirement: nuevo texto
   - Rewards: 4 items con valores correctos ($250, $300)
   - Commission: "50% per sale"

**Rollback:**
```sql
UPDATE phase_levels
SET 
  commission_rate = 0.40,
  credit_cents = 24000,
  free_product_value_cents = 0,
  descriptor_en = 'Maintain network momentum with active subscriptions across your first and second levels for an entire billing cycle.',
  requirement_en = 'Sustain network activity across 2 levels for one full cycle.',
  rewards_en = ARRAY[
    'Choose free products (valued at ${{freeProductValue}})',
    'Receive a ${{walletCredit}} wallet balance credit'
  ],
  visibility_tag_en = 'VISIBLE'
WHERE level = 3;
```

---

## Verificación de Multilingüe

### Prueba de Idiomas

1. **Inglés**: http://localhost:3000/en
   - Verificar que use `descriptor_en`, `requirement_en`, `rewards_en`, `visibility_tag_en`

2. **Español**: http://localhost:3000/es
   - Verificar que use `descriptor_es`, `requirement_es`, `rewards_es`, `visibility_tag_es`

### Prueba de Fallback

Si un campo está vacío, debe usar el valor del diccionario por defecto:

```sql
-- Dejar descriptor_es vacío
UPDATE phase_levels SET descriptor_es = NULL WHERE level = 0;
```

**Resultado Esperado**: La landing page en español debe mostrar un texto por defecto del diccionario.

---

## Comandos Útiles

### Ver Todos los Valores Actuales

```sql
SELECT 
  level,
  name,
  (commission_rate * 100)::text || '%' as commission,
  (credit_cents / 100.0)::text || ' USD' as wallet_credit,
  (free_product_value_cents / 100.0)::text || ' USD' as free_product,
  descriptor_en,
  requirement_en,
  array_length(rewards_en, 1) as rewards_count,
  visibility_tag_en
FROM phase_levels
ORDER BY display_order;
```

### Resetear a Valores Por Defecto

```sql
-- Ejecutar la migración nuevamente para restaurar valores por defecto
-- Ver: docs/database/migrations/add_phase_levels_landing_fields.sql
```

---

## Checklist de Verificación

- [ ] Porcentajes de comisión se actualizan dinámicamente
- [ ] Valores de productos gratis se actualizan en rewards
- [ ] Créditos de billetera se actualizan en rewards y highlights
- [ ] Descriptores se actualizan en ambos idiomas
- [ ] Requirements se actualizan en ambos idiomas
- [ ] Rewards se actualizan con tokens reemplazados
- [ ] Visibility tags se actualizan
- [ ] Múltiples cambios simultáneos funcionan
- [ ] Fallback a diccionario funciona si campos están vacíos
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en logs del servidor

---

## Notas Importantes

1. **Caché**: Si los cambios no se reflejan inmediatamente, limpiar caché del navegador (Ctrl+Shift+R)
2. **Servidor**: Asegurarse de que el servidor de desarrollo esté corriendo
3. **Base de Datos**: Todos los cambios deben hacerse en la base de datos `developer` (zqpfsdlfxvensqevzeco)
4. **Tokens**: Los tokens `{{...}}` se reemplazan automáticamente en tiempo de ejecución
5. **Validación**: Los valores de cents se dividen por 100 automáticamente para mostrar en $

