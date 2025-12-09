# 🚀 Desplegar Edge Function - Registration Access Code

## Mejoras Aplicadas

### ✅ Optimizaciones Implementadas

1. **Generación de Código Mejorada**
   - Formato: `PURVITA-XXXXX` (más legible y branded)
   - Caracteres sin ambigüedad (sin I, O, 0, 1)
   - Más fácil de comunicar por teléfono/email

2. **Corrección del Bug de Validación**
   - Cambio de `.gt()` a `.gte()` para cerrar ventanas previas
   - Consistente con la corrección en el repositorio

3. **Mejor Logging y Observabilidad**
   - Tiempo de ejecución incluido en respuesta
   - Logs estructurados con emojis para fácil identificación
   - Información detallada de errores

4. **Respuestas JSON Mejoradas**
   - Todas las respuestas son JSON (incluso errores)
   - Headers Content-Type consistentes
   - Información de éxito/error más clara

5. **Documentación en Código**
   - JSDoc comments para funciones principales
   - Comentarios explicativos en lógica compleja

## Instalación de Supabase CLI

### Windows (PowerShell como Administrador)

```powershell
# Opción 1: Usando Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Opción 2: Usando npm
npm install -g supabase

# Opción 3: Descarga directa
# Ve a: https://github.com/supabase/cli/releases
# Descarga el .exe para Windows y agrégalo al PATH
```

### Verificar Instalación

```bash
supabase --version
```

## Pasos para Desplegar

### 1. Login a Supabase

```bash
supabase login
```

Esto abrirá tu navegador para autenticarte.

### 2. Link al Proyecto

```bash
# Opción A: Link interactivo
supabase link

# Opción B: Link directo con project-ref
supabase link --project-ref purvita-developers
```

Para encontrar tu `project-ref`:
1. Ve a tu proyecto en Supabase Dashboard
2. Settings → General
3. Copia el "Reference ID"

### 3. Desplegar la Función

```bash
# Desplegar solo esta función
supabase functions deploy registration-access-code

# O desplegar todas las funciones
supabase functions deploy
```

### 4. Verificar el Despliegue

```bash
# Ver logs en tiempo real
supabase functions logs registration-access-code --follow

# Ver logs recientes
supabase functions logs registration-access-code
```

### 5. Probar la Función

```bash
# Invocar manualmente
supabase functions invoke registration-access-code --method POST

# O con curl
curl -X POST \
  https://purvita-developers.supabase.co/functions/v1/registration-access-code \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Configurar Cron Job (Ejecución Semanal)

### Opción 1: Supabase Dashboard

1. Ve a **Database → Cron Jobs** (o usa pg_cron extension)
2. Crea un nuevo job:

```sql
-- Ejecutar cada lunes a las 00:00 UTC
SELECT cron.schedule(
  'generate-weekly-registration-code',
  '0 0 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://purvita-developers.supabase.co/functions/v1/registration-access-code',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Opción 2: Supabase CLI

Crea un archivo `supabase/functions/registration-access-code/cron.sql`:

```sql
-- Schedule weekly code generation
-- Runs every Monday at 00:00 UTC
SELECT cron.schedule(
  'generate-weekly-registration-code',
  '0 0 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://purvita-developers.supabase.co/functions/v1/registration-access-code',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
```

Luego ejecuta en el SQL Editor de Supabase.

### Verificar Cron Jobs

```sql
-- Ver todos los cron jobs
SELECT * FROM cron.job;

-- Ver historial de ejecuciones
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-weekly-registration-code')
ORDER BY start_time DESC
LIMIT 10;
```

## Variables de Entorno

La función usa estas variables automáticamente:
- `SUPABASE_URL` - Configurada automáticamente
- `SUPABASE_SERVICE_ROLE_KEY` - Configurada automáticamente

No necesitas configurar nada adicional.

## Monitoreo

### Ver Logs en Dashboard

1. Ve a **Edge Functions** en Supabase Dashboard
2. Selecciona `registration-access-code`
3. Ve a la pestaña **Logs**

### Logs desde CLI

```bash
# Logs en tiempo real
supabase functions logs registration-access-code --follow

# Últimos 100 logs
supabase functions logs registration-access-code --limit 100

# Filtrar por nivel
supabase functions logs registration-access-code --level error
```

## Troubleshooting

### Error: "Supabase client not initialized"

**Causa**: Variables de entorno no configuradas
**Solución**: Verifica en Dashboard → Settings → API que las keys estén activas

### Error: "Failed to close previous windows"

**Causa**: Problema con la query de actualización
**Solución**: Verifica que la tabla `registration_access_codes` existe y tiene los permisos correctos

### Error: "Failed to store code"

**Causa**: Posible conflicto de unique constraint
**Solución**: Verifica que no haya códigos duplicados para la misma semana

### La función no se ejecuta automáticamente

**Causa**: Cron job no configurado o deshabilitado
**Solución**: 
1. Verifica que pg_cron extension esté habilitada
2. Revisa el cron job con `SELECT * FROM cron.job`
3. Verifica logs con `SELECT * FROM cron.job_run_details`

## Rollback

Si necesitas volver a la versión anterior:

```bash
# Ver versiones anteriores
supabase functions list --project-ref purvita-developers

# Hacer rollback (si es necesario)
# Nota: Supabase no tiene rollback automático, necesitas redesplegar la versión anterior
```

## Testing Local

```bash
# Iniciar Supabase localmente
supabase start

# Servir la función localmente
supabase functions serve registration-access-code

# En otra terminal, probar
curl -X POST http://localhost:54321/functions/v1/registration-access-code
```

## Próximos Pasos

1. ✅ Desplegar la función
2. ✅ Configurar cron job semanal
3. ✅ Verificar primera ejecución
4. ✅ Monitorear logs por una semana
5. 📧 Opcional: Configurar alertas por email si falla
