# Sistema de Fases MLM - PūrVita

Este documento consolida toda la información sobre el sistema de fases multinivel, incluyendo cálculo automático, preservación en reactivación y guía de cascada.

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Criterios de Promoción](#criterios-de-promoción)
- [Sistema Automático](#sistema-automático)
- [Preservación en Reactivación](#preservación-en-reactivación)
- [Recalculación en Cascada](#recalculación-en-cascada)
- [Edición Manual](#edición-manual)
- [Instalación y Verificación](#instalación-y-verificación)
- [Troubleshooting](#troubleshooting)

---

## Descripción General

El sistema de fases multinivel (MLM) actualiza automáticamente las fases de los usuarios basándose en el crecimiento de su red. Cuando un usuario paga su suscripción, el sistema recalcula automáticamente:

1. ✅ **La fase del usuario que pagó**
2. ✅ **Las fases de todos sus patrocinadores** (hasta 10 niveles hacia arriba)

---

## Criterios de Promoción

### Tabla de Fases

| Fase | Nombre | Referidos Directos | Segundo Nivel | Comisión | Créditos | Producto Gratis |
|------|--------|-------------------|---------------|----------|----------|-----------------|
| 0 | Registro | 0 | 0 | 8% | $0 | $65 |
| 1 | Primeros Socios | 2+ | 0 | 15% | $0 | $65 |
| 2 | Equipo Duplicado | 2+ | 4+ (min 2 por rama) | 30% | $125 | No |
| 3 | Momentum de Red | 2+ | 4+ (min 2 por rama) | 40% | $240 | No |

### Fase 0: Registro

- **Requisito**: Usuario tiene suscripción activa
- **Comisión**: 8%
- **Recompensas**: Producto gratis valorado en $65

### Fase 1: Primeros Socios

- **Requisito**: 2+ referidos directos con suscripción activa
- **Comisión**: 15%
- **Recompensas**: Producto gratis valorado en $65

### Fase 2: Equipo Duplicado

- **Requisitos**:
  - Cumple Fase 1
  - 4+ usuarios en segundo nivel (total)
  - Cada referido directo tiene al menos 2 referidos
- **Comisión**: 30%
- **Recompensas**: $125 en créditos de tienda

### Fase 3: Momentum de Red

- **Requisitos**:
  - Cumple Fase 2
  - 2+ referidos directos activos
  - Cada referido directo tiene al menos 2 referidos
- **Comisión**: 40%
- **Recompensas**: $240 en créditos de tienda

---

## Sistema Automático

### Flujo Automático

#### Ejemplo Práctico

```text
Usuario Principal (Fase 0)
├── Referido A (sin suscripción)
└── Referido B (sin suscripción)

1️⃣ Referido A paga su suscripción
   → Referido A pasa a Fase 0
   → Usuario Principal se recalcula (aún Fase 0, solo tiene 1 activo)

2️⃣ Referido B paga su suscripción
   → Referido B pasa a Fase 0
   → Usuario Principal se recalcula → ¡PASA A FASE 1! (tiene 2 activos)

3️⃣ Referido A agrega 2 personas que pagan
   → Referido A pasa a Fase 1
   → Usuario Principal se recalcula (progreso hacia Fase 2)

4️⃣ Referido B agrega 2 personas que pagan
   → Referido B pasa a Fase 1
   → Usuario Principal se recalcula → ¡PASA A FASE 2! (4 en segundo nivel)
```

### Arquitectura Técnica

#### 1. Función de Recalculación Individual

**Función**: `recalculate_phase(p_user UUID)`
**Ubicación**: `docs/database/full-schema.sql` (línea 2314)

Recalcula la fase de un usuario específico basándose en:

- Estado de su suscripción
- Número de referidos directos activos
- Número de usuarios en segundo nivel
- Distribución de usuarios por referido

#### 2. Función de Recalculación en Cascada

**Función**: `recalculate_sponsor_phases_cascade(p_user UUID)`
**Ubicación**: `docs/database/full-schema.sql` (línea 2433)

Recorre la cadena de patrocinadores hacia arriba y recalcula cada uno:

```sql
CREATE OR REPLACE FUNCTION public.recalculate_sponsor_phases_cascade(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_sponsor UUID;
  max_iterations INTEGER := 10; -- Máximo 10 niveles
  iteration_count INTEGER := 0;
BEGIN
  -- Obtener el patrocinador directo
  SELECT referred_by INTO current_sponsor
  FROM public.profiles
  WHERE id = p_user;

  -- Recorrer la cadena de patrocinadores
  WHILE current_sponsor IS NOT NULL AND iteration_count < max_iterations LOOP
    -- Recalcular fase del patrocinador actual
    PERFORM public.recalculate_phase(current_sponsor);
    
    -- Subir al siguiente nivel
    SELECT referred_by INTO current_sponsor
    FROM public.profiles
    WHERE id = current_sponsor;
    
    iteration_count := iteration_count + 1;
  END LOOP;
END;
$$;
```

#### 3. Trigger Automático

**Trigger**: `trigger_recalculate_phases_on_subscription_active`
**Tabla**: `subscriptions`
**Eventos**: `INSERT` o `UPDATE` de `status` o `waitlisted`

```sql
CREATE TRIGGER trigger_recalculate_phases_on_subscription_active
  AFTER INSERT OR UPDATE OF status, waitlisted
  ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_activation();
```

**Función del trigger**: `handle_subscription_activation()`

```sql
CREATE OR REPLACE FUNCTION public.handle_subscription_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo cuando la suscripción se vuelve activa
  IF NEW.status = 'active' 
     AND NEW.waitlisted = FALSE 
     AND (OLD.status IS NULL OR OLD.status != 'active' OR OLD.waitlisted = TRUE) THEN
    
    -- 1. Recalcular fase del usuario
    PERFORM public.recalculate_phase(NEW.user_id);
    
    -- 2. Recalcular fases de todos los patrocinadores
    PERFORM public.recalculate_sponsor_phases_cascade(NEW.user_id);
    
  END IF;

  RETURN NEW;
END;
$$;
```

---

## Preservación en Reactivación

### Lógica de Negocio

Cuando un usuario reactiva su suscripción después de una cancelación, el sistema mantiene su fase previamente alcanzada. Esto previene que los usuarios sean degradados simplemente por cancelar temporalmente.

### Preservación Automática

**Primera activación**: El sistema calcula la fase basándose en métricas de red

**Reactivación**: El sistema preserva la fase más alta alcanzada, incluso si las métricas actuales resultarían en una fase menor

### Cambios en la Base de Datos

#### Nuevas Columnas en `phases`

```sql
-- Indica si la fase fue establecida manualmente por admin
manual_phase_override boolean NOT NULL DEFAULT FALSE

-- Rastrea la fase más alta alcanzada por el usuario
highest_phase_achieved integer NOT NULL DEFAULT 0 CHECK (highest_phase_achieved BETWEEN 0 AND 3)
```

### Función Modificada: `recalculate_phase(p_user uuid)`

La función ahora:

1. Verifica si el usuario tuvo una suscripción previa revisando el historial de pagos
2. Obtiene la fase actual y `highest_phase_achieved`
3. Omite recalculación si `manual_phase_override` es `true`
4. Calcula la nueva fase basándose en métricas de red
5. **Preserva la fase más alta alcanzada** si el usuario está reactivando y la fase calculada es menor
6. Actualiza `highest_phase_achieved` si la nueva fase es mayor

### Función para Admins: `admin_set_user_phase(p_user_id, p_new_phase, p_admin_id)`

Permite a los admins establecer manualmente la fase de un usuario con:

- Validación de permisos de admin
- Validación de rango de fase (0-3)
- Establece tasa de comisión apropiada según fase
- Establece flag `manual_phase_override` a `true`
- Actualiza `highest_phase_achieved` si aplica
- Registra la acción en audit logs

---

## Recalculación en Cascada

### Guía de Instalación

#### Opción 1: Schema Completo (Recomendado)

```bash
psql -d your_database_name -U your_username -f docs/database/full-schema.sql
```

Esto recrea las funciones `recalculate_phase`, `recalculate_sponsor_phases_cascade` y el trigger `trigger_recalculate_phases_on_subscription_active`.

#### Opción 2: Migración Puntual (Solo para Debugging)

```bash
git show <commit>:docs/migrations/20250216_cascade_phase_recalculation.sql > /tmp/cascade.sql
psql -d your_database_name -U your_username -f /tmp/cascade.sql
```

### Verificación

```sql
SELECT proname
FROM pg_proc
WHERE proname IN (
  'recalculate_phase',
  'recalculate_sponsor_phases_cascade',
  'handle_subscription_activation'
);
```

Debe devolver tres filas.

### Prueba Rápida

```sql
-- Activar una suscripción de prueba
UPDATE subscriptions
SET status = 'active', waitlisted = false
WHERE id = '<subscription_id>';

-- Confirmar que se recalcularon fases
SELECT * FROM phase_history WHERE subscription_id = '<subscription_id>';
```

---

## Edición Manual

### Desde el Panel de Administración

Los administradores pueden editar manualmente las fases desde:

**Ruta**: `/admin/users/edit/[id]`
**Sección**: "Phase & Rewards"

#### Componente

```tsx
<PhaseRewardsAdminSection
  phase={phase}
  rewards={rewards}
  userPhase={userPhase}
  setUserPhase={setUserPhase}
  grantReward={grantReward}
  setGrantReward={setGrantReward}
  dict={dict.admin.phaseRewardsSettings ?? {}}
/>
```

#### API Endpoint

**Ruta**: `PUT /api/admin/users/[id]`
**Payload**:

```json
{
  "phase": {
    "phase": 2,
    "ecommerce_commission": 0.30
  }
}
```

**Nota**: La edición manual sobrescribe la fase automática, pero en el próximo recálculo automático (cuando alguien en la red pague), la fase se volverá a calcular según los criterios.

### API Endpoints

#### PATCH `/api/admin/users/[userId]/phase`

Establecer manualmente la fase de un usuario (solo admin).

**Request Body:**

```json
{
  "phase": 2
}
```

**Response:**

```json
{
  "success": true,
  "phase": 2,
  "message": "Phase updated successfully with manual override"
}
```

#### GET `/api/admin/users/[userId]/phase`

Obtener información actual de fase para un usuario (solo admin).

**Response:**

```json
{
  "phase": 2,
  "highest_phase_achieved": 2,
  "manual_phase_override": false,
  "ecommerce_commission": 0.12,
  "phase1_granted": true,
  "phase2_granted": true,
  "phase3_granted": false,
  "phase2_achieved_at": "2024-10-24T10:30:00Z",
  "created_at": "2024-01-15T08:00:00Z",
  "updated_at": "2024-10-24T10:30:00Z"
}
```

---

## Instalación y Verificación

### Aplicar Migración

```bash
psql -d your_database -f docs/migrations/20250216_cascade_phase_recalculation.sql
```

O aplicar manualmente desde `docs/database/database.sql` (líneas 2425-2504 y 2109-2127).

### Verificar Instalación

```sql
-- Verificar que las funciones existen
SELECT proname FROM pg_proc WHERE proname IN (
  'recalculate_phase',
  'recalculate_sponsor_phases_cascade',
  'handle_subscription_activation'
);

-- Verificar que el trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_recalculate_phases_on_subscription_active';
```

### Probar el Sistema

```sql
-- 1. Encontrar un usuario con patrocinador
SELECT id, referred_by, email FROM profiles WHERE referred_by IS NOT NULL LIMIT 1;

-- 2. Activar su suscripción
UPDATE subscriptions 
SET status = 'active', waitlisted = false 
WHERE user_id = '<user_id>';

-- 3. Verificar que se recalcularon las fases
SELECT p.email, ph.phase, ph.updated_at 
FROM profiles p
JOIN phases ph ON ph.user_id = p.id
WHERE p.id IN (
  SELECT referred_by FROM profiles WHERE id = '<user_id>'
)
ORDER BY ph.updated_at DESC;
```

---

## Troubleshooting

### Las fases no se actualizan automáticamente

**1. Verificar que el trigger existe**:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_recalculate_phases_on_subscription_active';
```

**2. Verificar logs de la base de datos**:

```sql
-- Buscar warnings de max iterations
SELECT * FROM pg_stat_activity WHERE query LIKE '%recalculate%';
```

**3. Ejecutar manualmente**:

```sql
SELECT recalculate_sponsor_phases_cascade('<user_id>');
```

### Fase incorrecta después de recalcular

**1. Verificar datos de la red**:

```sql
-- Ver referidos directos activos
SELECT COUNT(*)
FROM profiles p
JOIN subscriptions s ON s.user_id = p.id
WHERE p.referred_by = '<user_id>'
  AND s.status = 'active'
  AND s.waitlisted = FALSE;
```

**2. Ejecutar recalculación manual**:

```sql
SELECT recalculate_phase('<user_id>');
SELECT * FROM phases WHERE user_id = '<user_id>';
```

### Usuario ve datos de otro usuario después de reactivación

**Verificar preservación de fase**:

```sql
SELECT
  phase,
  highest_phase_achieved,
  manual_phase_override,
  updated_at
FROM phases
WHERE user_id = '<user_id>';
```

---

## Consideraciones Importantes

### Límite de Niveles

- El sistema recalcula hasta **10 niveles** hacia arriba
- Esto previene loops infinitos en caso de datos corruptos
- Si se alcanza el límite, se registra un WARNING en los logs

### Performance

- Cada recalculación ejecuta queries SQL
- En redes muy grandes (10 niveles con muchos usuarios), puede tomar algunos segundos
- El trigger se ejecuta de forma asíncrona después del commit

### Idempotencia

- La función `recalculate_phase` es idempotente
- Puede ejecutarse múltiples veces sin efectos secundarios
- Siempre calcula la fase correcta basándose en el estado actual

### Seguridad

- Solo admins pueden establecer fases manualmente
- Todos los cambios manuales se registran en audit logs
- El flag `manual_phase_override` previene degradaciones accidentales
- La preservación de fase solo aplica a usuarios con historial de pagos

---

## Escenarios de Uso

### Escenario 1: Usuario Reactiva Suscripción

1. Usuario alcanza Fase 2 con 4 referidos activos de segundo nivel
2. Usuario cancela suscripción
3. Algunos referidos se vuelven inactivos, reduciendo la red a métricas de Fase 1
4. Usuario reactiva suscripción
5. **Resultado**: Usuario permanece en Fase 2 (preservado de `highest_phase_achieved`)

### Escenario 2: Override Manual de Admin

1. Admin quiere recompensar a un usuario estableciéndolo en Fase 3
2. Admin llama `PATCH /api/admin/users/{userId}/phase` con `{ "phase": 3 }`
3. Sistema establece `manual_phase_override = true`
4. **Resultado**: Usuario permanece en Fase 3 independientemente de métricas de red hasta que admin lo cambie

### Escenario 3: Usuario Crece Red Después de Reactivación

1. Usuario reactiva en Fase 2 preservada
2. Usuario crece red para cumplir requisitos de Fase 3
3. Sistema calcula elegibilidad para Fase 3
4. **Resultado**: Usuario es promovido a Fase 3, y `highest_phase_achieved` se actualiza

---

## Referencias

### Archivos Clave

- `docs/database/full-schema.sql` - Schema completo con funciones y triggers
- `docs/migrations/20250216_cascade_phase_recalculation.sql` - Migración de cascada
- `src/modules/multilevel/services/subscription-lifecycle-service.ts` - Servicio de suscripciones
- `src/components/admin/phase-rewards-admin-section.tsx` - Componente admin
- `src/app/api/admin/users/[id]/route.ts` - API admin

### Documentación Relacionada

- [Sistema de Comisiones](commission-system.md)
- [Guía de Administración](admin-guide.md)
- [Modelos de Datos](data-models.md)

---

**Última actualización**: 2025-10-24
**Versión**: 2.0
**Estado**: ✅ Implementado y Documentado
