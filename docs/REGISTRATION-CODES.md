# Sistema de Códigos de Registro

## ✅ Problema Resuelto

Se corrigió un bug crítico en la validación de códigos:

**Antes (❌ Bug):**
```typescript
.gt('valid_to', isoDate)  // valid_to > fecha_actual (excluye el momento exacto)
```

**Después (✅ Correcto):**
```typescript
.gte('valid_to', isoDate)  // valid_to >= fecha_actual (incluye el momento exacto)
```

Este cambio permite que los códigos válidos sean encontrados correctamente durante todo su período de validez.

## Cómo Funciona

El sistema valida que los usuarios tengan un código de acceso válido antes de permitir el registro. Los códigos tienen:
- Un valor único (ej: `PURVITA-2025`)
- Fecha de inicio (`valid_from`)
- Fecha de expiración (`valid_to`)

## Agregar un Código de Registro

### Opción 1: SQL Editor de Supabase (Recomendado)

1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Ejecuta este SQL:

```sql
INSERT INTO public.registration_access_codes (code, valid_from, valid_to)
VALUES (
  'PURVITA-2025',
  NOW(),
  NOW() + INTERVAL '30 days'
);
```

4. Usa el código `PURVITA-2025` para registrarte

### Opción 2: Usar el script SQL incluido

Ejecuta el archivo `scripts/insert-registration-code.sql` en el SQL Editor de Supabase.

### Opción 3: API de Admin (requiere autenticación)

```bash
curl -X POST http://localhost:9002/api/admin/registration-codes \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PURVITA-2025",
    "validFrom": "2025-01-07T00:00:00Z",
    "validTo": "2025-02-07T00:00:00Z"
  }'
```

## Verificar Códigos Activos

Ejecuta en el SQL Editor:

```sql
SELECT 
  id,
  code,
  valid_from,
  valid_to,
  CASE 
    WHEN valid_from <= NOW() AND valid_to >= NOW() THEN '✅ ACTIVO'
    WHEN valid_from > NOW() THEN '⏳ FUTURO'
    ELSE '❌ EXPIRADO'
  END as status
FROM public.registration_access_codes
ORDER BY valid_from DESC;
```

## Verificar Estado de Códigos

Usa el script `scripts/check-registration-codes.sql` en el SQL Editor de Supabase para ver:
- Códigos activos, futuros y expirados
- Tiempo restante de validez
- Estadísticas generales

## Solución de Problemas

### Error: "The provided access code is invalid or expired"

**Diagnóstico paso a paso:**

1. **Verifica que existe un código activo**
   ```sql
   SELECT code, valid_from, valid_to
   FROM public.registration_access_codes
   WHERE valid_from <= NOW() AND valid_to >= NOW()
   ORDER BY valid_from DESC LIMIT 1;
   ```
   
   - Si no hay resultados → Inserta un código nuevo
   - Si hay resultado → Usa ese código exacto

2. **Verifica que el código esté bien escrito**
   - Los códigos se normalizan a mayúsculas automáticamente
   - `purvita-2025` = `PURVITA-2025` = `PuRvItA-2025`
   - Espacios al inicio/final se eliminan automáticamente

3. **Verifica las variables de entorno**
   ```bash
   # Windows PowerShell
   Get-Content .env.local | Select-String SUPABASE
   
   # Windows CMD
   type .env.local | findstr SUPABASE
   ```
   
   Deberías ver:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. **Reinicia el servidor de desarrollo**
   ```bash
   # Detén el servidor (Ctrl+C) y reinicia
   npm run dev
   ```

### Logs de Depuración

Si el problema persiste, revisa los logs del servidor:
- Busca `[api.auth.registration-code.validate]` en la consola
- Verifica errores de conexión a Supabase
- Confirma que el service role key es válido

## Ejemplos de Códigos

```sql
-- Código mensual
INSERT INTO public.registration_access_codes (code, valid_from, valid_to)
VALUES ('PURVITA-JAN-2025', '2025-01-01', '2025-02-01');

-- Código trimestral
INSERT INTO public.registration_access_codes (code, valid_from, valid_to)
VALUES ('PURVITA-Q1-2025', '2025-01-01', '2025-04-01');

-- Código de evento especial
INSERT INTO public.registration_access_codes (code, valid_from, valid_to)
VALUES ('LAUNCH-SPECIAL', NOW(), NOW() + INTERVAL '48 hours');
```

## Arquitectura

- **Tabla**: `registration_access_codes`
- **Repositorio**: `src/modules/registration-access/repositories/registration-access-code-repository.ts`
- **Servicio**: `src/modules/registration-access/services/registration-access-service.ts`
- **API**: `src/app/api/auth/registration-code/validate/route.ts`
- **UI**: `src/app/[lang]/auth/register/page.tsx`
