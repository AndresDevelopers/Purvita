# Sistema de Conteo de Equipo Basado en Suscripciones

## 📋 Descripción General

Este documento describe el nuevo sistema de conteo de equipo (`team_count`) que ahora está basado en suscripciones activas en lugar de registros simples.

## 🎯 Regla de Negocio

### Antes (Sistema Antiguo)
- ❌ Cuando alguien se registraba en la página de afiliado, se contaba **inmediatamente** en el `team_count` del sponsor
- ❌ No importaba si la persona tenía o no una suscripción activa

### Ahora (Sistema Nuevo)
- ✅ Cuando alguien se registra en la página de afiliado, **NO** se cuenta en el `team_count` del sponsor
- ✅ Solo se cuenta en el `team_count` cuando esa persona **activa una suscripción**
- ✅ Si la suscripción se cancela o expira, se **descuenta** del `team_count`

## 🔧 Cambios Técnicos Implementados

### 1. Función `recalculate_team_count()`
**Ubicación**: `docs/database/full-schema.sql` (líneas 65-94)

**Cambio**: Ahora solo cuenta usuarios con suscripción activa

```sql
SELECT COUNT(*) INTO new_count
FROM public.profiles p
INNER JOIN public.subscriptions s ON s.user_id = p.id
WHERE
  p.referred_by = sponsor_id
  AND s.status = 'active';
```

### 2. Función `update_team_counts()`
**Ubicación**: `docs/database/full-schema.sql` (líneas 95-127)

**Cambio**: Eliminada la lógica de incremento automático en INSERT

**Antes**:
```sql
IF(TG_OP = 'INSERT' AND NEW.referred_by IS NOT NULL) THEN
  UPDATE public.profiles
  SET team_count = team_count + 1
  WHERE id = NEW.referred_by;
```

**Ahora**: Esta lógica fue eliminada. El trigger solo maneja UPDATE y DELETE de `referred_by`.

### 3. Función `handle_subscription_activation()`
**Ubicación**: `docs/database/full-schema.sql` (líneas 2085-2123)

**Cambio**: Ahora actualiza el `team_count` del sponsor cuando cambia el estado de suscripción

**Nueva lógica**:
```sql
-- Cuando la suscripción se activa
IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
  PERFORM public.recalculate_team_count(sponsor_id);
END IF;

-- Cuando la suscripción se desactiva
ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
  PERFORM public.recalculate_team_count(sponsor_id);
END IF;
```

## 📊 Flujo de Eventos

### Escenario 1: Nuevo Usuario se Registra
```
1. Usuario visita: /affiliate/[referralCode]/register
2. Usuario completa el formulario de registro
3. Sistema crea perfil con referred_by = sponsor_id
4. ❌ team_count del sponsor NO se incrementa
5. ✅ Usuario aparece en la lista de referidos pero sin contar en el team
```

### Escenario 2: Usuario Activa Suscripción
```
1. Usuario registrado activa una suscripción
2. Sistema actualiza subscriptions.status = 'active'
3. Trigger handle_subscription_activation() se ejecuta
4. ✅ team_count del sponsor SE INCREMENTA
5. ✅ Usuario ahora cuenta en el equipo del sponsor
```

### Escenario 3: Usuario Cancela Suscripción
```
1. Usuario cancela su suscripción
2. Sistema actualiza subscriptions.status = 'canceled'
3. Trigger handle_subscription_activation() se ejecuta
4. ✅ team_count del sponsor SE DECREMENTA
5. ✅ Usuario ya no cuenta en el equipo del sponsor
```

## 🚀 Aplicar la Migración

Para aplicar estos cambios a tu base de datos, ejecuta el archivo de migración:

```bash
# Opción 1: Desde Supabase Dashboard
# 1. Ve a SQL Editor
# 2. Copia el contenido de: docs/database/migrations/update-team-count-subscription-based.sql
# 3. Ejecuta el script

# Opción 2: Desde línea de comandos (si tienes acceso directo a PostgreSQL)
psql -h [host] -U [user] -d [database] -f docs/database/migrations/update-team-count-subscription-based.sql
```

## ✅ Verificación

Después de aplicar la migración, puedes verificar que todo funciona correctamente:

### 1. Verificar que los team_count se recalcularon
```sql
SELECT
  p.id,
  p.name,
  p.email,
  p.team_count,
  COUNT(DISTINCT s.user_id) as active_subscriptions_count
FROM public.profiles p
LEFT JOIN public.profiles referred ON referred.referred_by = p.id
LEFT JOIN public.subscriptions s ON s.user_id = referred.id
  AND s.status = 'active'
WHERE p.team_count > 0 OR referred.id IS NOT NULL
GROUP BY p.id, p.name, p.email, p.team_count
ORDER BY p.team_count DESC;
```

El `team_count` debe coincidir con `active_subscriptions_count`.

### 2. Probar el flujo completo
1. Registra un nuevo usuario a través de un enlace de afiliado
2. Verifica que el `team_count` del sponsor NO aumentó
3. Activa una suscripción para ese usuario
4. Verifica que el `team_count` del sponsor SÍ aumentó
5. Cancela la suscripción
6. Verifica que el `team_count` del sponsor disminuyó

## 📝 Notas Importantes

1. **Compatibilidad hacia atrás**: La migración recalcula automáticamente todos los `team_count` existentes, por lo que los valores históricos se ajustarán a la nueva lógica.

2. **Rendimiento**: La función `recalculate_team_count()` hace un JOIN con la tabla `subscriptions`, lo cual es eficiente gracias a los índices existentes.

3. **Consistencia**: El sistema ahora es más consistente porque el `team_count` siempre refleja el número real de miembros activos (con suscripción).

4. **Notificaciones**: Las notificaciones de "nuevo miembro del equipo" seguirán enviándose al registrarse, pero el conteo oficial solo se actualiza con suscripción activa.

## 🔍 Archivos Modificados

1. `docs/database/full-schema.sql` - Schema principal actualizado
2. `docs/database/migrations/update-team-count-subscription-based.sql` - Script de migración
3. `docs/TEAM_COUNT_SUBSCRIPTION_BASED.md` - Este documento

## 🆘 Soporte

Si encuentras algún problema después de aplicar la migración:

1. Verifica que todas las funciones se crearon correctamente
2. Ejecuta manualmente el recálculo para un sponsor específico:
   ```sql
   SELECT public.recalculate_team_count('[sponsor_id]');
   ```
3. Revisa los logs de PostgreSQL para errores en los triggers

