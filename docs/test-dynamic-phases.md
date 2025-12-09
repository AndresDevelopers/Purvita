# Pruebas de Fases Dinámicas en Landing Page

## Descripción

Este documento describe cómo probar la funcionalidad de fases dinámicas en la landing page. Las fases ahora se filtran automáticamente basándose en la configuración de `phase_levels` con `is_active = true`.

## Cambios Implementados

### 1. Servicio de Fases Activas
- **Archivo**: `src/modules/site-content/services/site-content-service.ts`
- **Función**: `getActivePhaseIds()`
- **Descripción**: Obtiene las fases activas desde `phase_levels` y las mapea a IDs de landing page

### 2. Filtrado en mergeLandingContent
- **Archivo**: `src/modules/site-content/services/site-content-service.ts`
- **Función**: `mergeLandingContent()`
- **Descripción**: Filtra las fases para mostrar solo las que están activas

### 3. Grid Responsivo
- **Archivo**: `src/modules/opportunity/components/opportunity-section.tsx`
- **Función**: `getGridCols()`
- **Descripción**: Ajusta el grid automáticamente según el número de fases visibles

## Escenarios de Prueba

### Escenario 1: Todas las Fases Activas (Por Defecto)

**Setup:**
```sql
-- Verificar que todas las fases estén activas
SELECT level, name, is_active FROM phase_levels ORDER BY display_order;
```

**Resultado Esperado:**
- La landing page muestra las 4 fases (Phase 0, 1, 2, 3)
- Grid con 4 columnas en pantallas grandes
- Todas las fases tienen el badge "VISIBLE"

**Verificación:**
1. Navegar a la landing page: `http://localhost:3000/en`
2. Scroll hasta la sección "Opportunity"
3. Verificar que se muestren 4 tarjetas de fases

---

### Escenario 2: Solo 3 Fases Activas

**Setup:**
```sql
-- Desactivar Phase 3 (level 3)
UPDATE phase_levels 
SET is_active = false 
WHERE level = 3;
```

**Resultado Esperado:**
- La landing page muestra solo 3 fases (Phase 0, 1, 2)
- Grid con 3 columnas en pantallas grandes
- Phase 3 NO aparece en la landing page

**Verificación:**
1. Ejecutar el SQL de setup
2. Recargar la landing page
3. Verificar que solo se muestren 3 tarjetas de fases
4. Verificar que el grid se ajuste a 3 columnas

**Rollback:**
```sql
UPDATE phase_levels 
SET is_active = true 
WHERE level = 3;
```

---

### Escenario 3: Solo 2 Fases Activas

**Setup:**
```sql
-- Desactivar Phase 2 y 3
UPDATE phase_levels 
SET is_active = false 
WHERE level IN (2, 3);
```

**Resultado Esperado:**
- La landing page muestra solo 2 fases (Phase 0, 1)
- Grid con 2 columnas en pantallas medianas
- Phases 2 y 3 NO aparecen

**Verificación:**
1. Ejecutar el SQL de setup
2. Recargar la landing page
3. Verificar que solo se muestren 2 tarjetas de fases
4. Verificar que el grid se ajuste a 2 columnas

**Rollback:**
```sql
UPDATE phase_levels 
SET is_active = true 
WHERE level IN (2, 3);
```

---

### Escenario 4: Solo 1 Fase Activa

**Setup:**
```sql
-- Desactivar todas excepto Phase 0
UPDATE phase_levels 
SET is_active = false 
WHERE level > 0;
```

**Resultado Esperado:**
- La landing page muestra solo 1 fase (Phase 0)
- Grid centrado con 1 columna
- Solo Phase 0 aparece

**Verificación:**
1. Ejecutar el SQL de setup
2. Recargar la landing page
3. Verificar que solo se muestre 1 tarjeta de fase
4. Verificar que esté centrada

**Rollback:**
```sql
UPDATE phase_levels 
SET is_active = true 
WHERE level > 0;
```

---

### Escenario 5: Cambio de Orden de Fases

**Setup:**
```sql
-- Cambiar el orden de visualización
UPDATE phase_levels SET display_order = 3 WHERE level = 0;
UPDATE phase_levels SET display_order = 0 WHERE level = 1;
UPDATE phase_levels SET display_order = 1 WHERE level = 2;
UPDATE phase_levels SET display_order = 2 WHERE level = 3;
```

**Resultado Esperado:**
- Las fases se muestran en el nuevo orden: Phase 1, 2, 3, 0
- El contenido de cada fase permanece igual

**Verificación:**
1. Ejecutar el SQL de setup
2. Recargar la landing page
3. Verificar el orden de las fases

**Rollback:**
```sql
UPDATE phase_levels SET display_order = 0 WHERE level = 0;
UPDATE phase_levels SET display_order = 1 WHERE level = 1;
UPDATE phase_levels SET display_order = 2 WHERE level = 2;
UPDATE phase_levels SET display_order = 3 WHERE level = 3;
```

---

## Pruebas de Integración

### Prueba 1: Admin Panel
1. Ir al panel de administración: `/admin/app-settings`
2. Desactivar una fase usando el toggle `is_active`
3. Guardar cambios
4. Verificar que la landing page se actualice automáticamente

### Prueba 2: Múltiples Idiomas
1. Cambiar el idioma a español: `http://localhost:3000/es`
2. Verificar que las fases filtradas se muestren correctamente
3. Cambiar de vuelta a inglés
4. Verificar consistencia

### Prueba 3: Caché
1. Desactivar una fase
2. Verificar que la landing page se actualice
3. Limpiar caché del navegador
4. Recargar y verificar que los cambios persistan

---

## Casos de Error

### Error 1: Tabla phase_levels No Existe
**Comportamiento Esperado:**
- La función `getActivePhaseIds()` captura el error
- Muestra todas las 4 fases por defecto (fallback)
- Log de advertencia en consola

### Error 2: Todas las Fases Desactivadas
**Setup:**
```sql
UPDATE phase_levels SET is_active = false;
```

**Comportamiento Esperado:**
- La sección de Opportunity no se muestra (array vacío)
- No hay error en consola
- El resto de la landing page funciona normalmente

**Rollback:**
```sql
UPDATE phase_levels SET is_active = true;
```

---

## Comandos Útiles

### Ver Estado Actual de Fases
```sql
SELECT 
  level,
  name,
  is_active,
  display_order,
  commission_rate
FROM phase_levels
ORDER BY display_order;
```

### Resetear a Configuración Por Defecto
```sql
UPDATE phase_levels SET is_active = true;
UPDATE phase_levels SET display_order = level;
```

### Verificar Logs del Servidor
```bash
# Buscar logs relacionados con fases
grep "SiteContentService" logs/server.log
grep "Failed to fetch active phase levels" logs/server.log
```

---

## Notas Técnicas

### Mapeo de Niveles a IDs
- `phase_levels.level 0` → `phase-1` (Phase 0 · Registration)
- `phase_levels.level 1` → `phase-2` (Phase 1 · First Partners)
- `phase_levels.level 2` → `phase-3` (Phase 2 · Duplicate Team)
- `phase_levels.level 3` → `phase-4` (Phase 3 · Network Momentum)

### Grid Responsivo
- 1 fase: `grid-cols-1 max-w-md mx-auto`
- 2 fases: `md:grid-cols-2 max-w-3xl mx-auto`
- 3 fases: `md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto`
- 4+ fases: `md:grid-cols-2 xl:grid-cols-4`

### Caché
- El contenido de la landing page se cachea en el servidor
- Los cambios en `phase_levels` requieren reiniciar el servidor de desarrollo
- En producción, el caché se invalida automáticamente

---

## Checklist de Verificación

- [ ] Las fases se filtran correctamente según `is_active`
- [ ] El grid se ajusta al número de fases visibles
- [ ] El orden de las fases respeta `display_order`
- [ ] Los cambios en el admin panel se reflejan en la landing page
- [ ] El fallback funciona si hay error en la base de datos
- [ ] La funcionalidad es consistente en todos los idiomas
- [ ] No hay errores en la consola del navegador
- [ ] No hay errores en los logs del servidor

