# Beneficios Multinivel Dinámicos - Página Teams

## Descripción

Los valores de beneficios en la sección "Multilevel benefits" de la página Teams ahora son completamente dinámicos y se configuran desde el panel de administración.

## Cambios Realizados

### 1. Nuevo Endpoint Público

**Archivo:** `src/app/api/public/phase-levels/route.ts`

- Endpoint público: `GET /api/public/phase-levels`
- Retorna solo los campos necesarios para mostrar beneficios:
  - `level`: Nivel de fase (0-3)
  - `commissionRate`: Porcentaje de comisión (0-1)
  - `creditCents`: Crédito en centavos
  - `freeProductValueCents`: Valor del producto gratis en centavos

### 2. Actualización de Teams Content

**Archivo:** `src/app/[lang]/teams/teams-content.tsx`

- Carga los datos de `phase_levels` al inicializar la página
- Reemplaza tokens dinámicos en los textos de beneficios:
  - `{{commission}}` → Porcentaje de comisión (ej: "8%", "15%")
  - `{{freeProductValue}}` → Valor del producto gratis (ej: "$65", "$125")
  - `{{walletCredit}}` → Crédito de billetera (ej: "$3", "$9")

### 3. Actualización de Diccionarios

**Archivos:**
- `src/i18n/dictionaries/default.ts` (Inglés)
- `src/i18n/dictionaries/locales/es.ts` (Español)

Los textos ahora usan tokens en lugar de valores hardcodeados:

**Antes:**
```typescript
"Earn 8% commission on your personal product sales."
"Choose one free product valued at $65."
"$3 credited to your wallet."
```

**Después:**
```typescript
"Earn {{commission}} commission on your personal product sales."
"Choose one free product valued at {{freeProductValue}}."
"{{walletCredit}} credited to your wallet."
```

## Cómo Configurar los Valores

### Desde el Panel de Administración

1. Ir a `/admin/app-settings`
2. En la sección "Multi-Level Network Configuration"
3. Editar cada fase (Phase 0, 1, 2, 3):
   - **Ecommerce Earnings (%)**: Porcentaje de comisión (ej: 8, 15, 30, 40)
   - **Reward Credit**: Crédito en dólares (ej: 0, 3, 9, 506)
   - **Free Product Value**: Valor del producto gratis en dólares (ej: 65, 125, 240)

### Desde la Base de Datos

Actualizar directamente la tabla `phase_levels`:

```sql
-- Ejemplo: Cambiar comisión de Phase 1 a 20%
UPDATE phase_levels 
SET commission_rate = 0.20 
WHERE level = 1;

-- Ejemplo: Cambiar crédito de Phase 2 a $15
UPDATE phase_levels 
SET credit_cents = 1500 
WHERE level = 2;

-- Ejemplo: Cambiar valor de producto gratis de Phase 1 a $100
UPDATE phase_levels 
SET free_product_value_cents = 10000 
WHERE level = 1;
```

## Pruebas de Verificación

### Escenario 1: Cambiar Comisión de Phase 0

**Setup:**
```sql
UPDATE phase_levels SET commission_rate = 0.10 WHERE level = 0;
```

**Verificación:**
1. Ir a `/en/teams` o `/es/teams`
2. Buscar la sección "Multilevel benefits"
3. En Phase 0, verificar que muestre: "Earn 10% commission" (en inglés) o "Recibe 10% de comisión" (en español)

**Rollback:**
```sql
UPDATE phase_levels SET commission_rate = 0.08 WHERE level = 0;
```

### Escenario 2: Cambiar Valor de Producto Gratis de Phase 1

**Setup:**
```sql
UPDATE phase_levels SET free_product_value_cents = 10000 WHERE level = 1;
```

**Verificación:**
1. Ir a `/en/teams` o `/es/teams`
2. En Phase 1, verificar que muestre: "valued at $100" (en inglés) o "valorado en $100" (en español)

**Rollback:**
```sql
UPDATE phase_levels SET free_product_value_cents = 6500 WHERE level = 1;
```

### Escenario 3: Cambiar Crédito de Billetera de Phase 2

**Setup:**
```sql
UPDATE phase_levels SET credit_cents = 1500 WHERE level = 2;
```

**Verificación:**
1. Ir a `/en/teams` o `/es/teams`
2. En Phase 2, verificar que muestre: "$15 credited to your wallet" (en inglés) o "$15 acreditados en tu billetera" (en español)

**Rollback:**
```sql
UPDATE phase_levels SET credit_cents = 900 WHERE level = 2;
```

### Escenario 4: Actualizar Todos los Valores de Phase 3

**Setup:**
```sql
UPDATE phase_levels 
SET 
  commission_rate = 0.50,
  credit_cents = 75000,
  free_product_value_cents = 30000
WHERE level = 3;
```

**Verificación:**
1. Ir a `/en/teams` o `/es/teams`
2. En Phase 3, verificar:
   - Comisión: "50%"
   - Producto gratis: "$300"
   - Crédito: "$750"

**Rollback:**
```sql
UPDATE phase_levels 
SET 
  commission_rate = 0.40,
  credit_cents = 50600,
  free_product_value_cents = 24000
WHERE level = 3;
```

## Estructura de Datos

### Tabla `phase_levels`

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `level` | integer | Nivel de fase (0-10) | 0, 1, 2, 3 |
| `commission_rate` | numeric(6,4) | Porcentaje de comisión (0-1) | 0.08, 0.15, 0.30, 0.40 |
| `credit_cents` | bigint | Crédito en centavos | 0, 300, 900, 50600 |
| `free_product_value_cents` | bigint | Valor del producto en centavos | 6500, 12500, 24000 |

### Conversión de Valores

- **Porcentaje:** `commission_rate * 100` → "8%", "15%", "30%", "40%"
- **Dólares:** `credit_cents / 100` → "$3", "$9", "$506"
- **Dólares:** `free_product_value_cents / 100` → "$65", "$125", "$240"

## Notas Importantes

1. **Cache:** El endpoint `/api/public/phase-levels` usa `cache: 'no-store'` para siempre obtener los valores más recientes.

2. **Seguridad:** El endpoint es público pero solo expone los campos necesarios para mostrar beneficios (no expone información sensible).

3. **Multilingüe:** Los tokens funcionan en ambos idiomas (inglés y español) automáticamente.

4. **Fallback:** Si no se pueden cargar los valores dinámicos, la página seguirá funcionando con los textos del diccionario.

5. **Admin Panel:** Los valores se pueden actualizar desde `/admin/app-settings` en la sección "Multi-Level Network Configuration".

## Archivos Modificados

1. `src/app/[lang]/teams/teams-content.tsx` - Lógica de reemplazo de tokens
2. `src/i18n/dictionaries/default.ts` - Diccionario en inglés con tokens
3. `src/i18n/dictionaries/locales/es.ts` - Diccionario en español con tokens
4. `src/app/api/public/phase-levels/route.ts` - Nuevo endpoint público (creado)

## Compatibilidad

- ✅ Next.js 14+
- ✅ React 18+
- ✅ Supabase
- ✅ TypeScript
- ✅ Multilingüe (i18n)

