# Troubleshooting: CSRF en Múltiples Dominios

## 🔍 Problema

Los modos del sitio (maintenance, coming soon) se pueden activar/desactivar en **desarrollo** pero **NO en producción** o en **dominios diferentes**.

### Síntomas

- ✅ Funciona en `localhost:9001`
- ❌ No funciona en `dominio1.com`
- ❌ No funciona en `dominio2.com`
- ❌ Error: "Invalid CSRF token" o "CSRF token validation failed"

## 🎯 Causa Raíz

Las **cookies CSRF** no se comparten correctamente entre dominios diferentes debido a:

1. **SameSite Policy**: Las cookies tienen `sameSite: 'lax'` que restringe el envío entre dominios
2. **Secure Flag**: En producción, las cookies requieren HTTPS (`secure: true`)
3. **Domain Scope**: Por defecto, las cookies solo funcionan en el dominio exacto donde se crearon

## ✅ Solución

### Opción 1: Configurar Dominio de Cookie (Recomendado para Subdominios)

Si usas **subdominios del mismo dominio** (ej: `app.tudominio.com`, `admin.tudominio.com`):

1. **Agregar variable de entorno** en cada deployment:

```bash
# Para subdominios de tudominio.com
CSRF_COOKIE_DOMAIN=.tudominio.com
```

⚠️ **Nota**: El punto inicial (`.`) es importante - permite que la cookie funcione en todos los subdominios.

2. **Reiniciar la aplicación** para que tome la nueva configuración

3. **Verificar** que funciona:
   - Ir al admin panel
   - Abrir DevTools → Application → Cookies
   - Verificar que la cookie `csrf-token` tiene `Domain: .tudominio.com`

### Opción 2: Dominios Completamente Diferentes

Si usas **dominios completamente diferentes** (ej: `dominio1.com`, `dominio2.com`):

**No puedes compartir cookies CSRF entre dominios diferentes** por seguridad del navegador.

**Soluciones alternativas:**

1. **Configuración por dominio**: Cada dominio debe tener su propia configuración CSRF
   - No configurar `CSRF_COOKIE_DOMAIN`
   - Cada dominio manejará sus propias cookies

2. **Usar un solo dominio principal**: Redirigir todos los dominios a uno principal
   - Ejemplo: `dominio1.com` → `dominio-principal.com`
   - `dominio2.com` → `dominio-principal.com`

### Opción 3: Verificar HTTPS

Las cookies CSRF en producción **requieren HTTPS**. Verifica:

1. **Todos los dominios usan HTTPS**
2. **Certificados SSL válidos**
3. **No hay mixed content** (HTTP + HTTPS)

## 🔧 Debugging

### 1. Verificar Cookies en el Navegador

1. Abrir DevTools (F12)
2. Ir a **Application** → **Cookies**
3. Buscar cookie `csrf-token`
4. Verificar:
   - ✅ `Domain`: Debe coincidir con tu configuración
   - ✅ `Secure`: Debe ser `true` en producción
   - ✅ `SameSite`: Debe ser `Lax`
   - ✅ `HttpOnly`: Debe ser `true`

### 2. Verificar Headers de Request

1. Abrir DevTools → **Network**
2. Hacer una acción que requiera CSRF (ej: activar modo)
3. Ver el request a `/api/admin/site-status`
4. Verificar headers:
   - ✅ `X-CSRF-Token`: Debe existir
   - ✅ `Cookie`: Debe incluir `csrf-token`

### 3. Ver Logs del Servidor

Buscar en los logs:

```bash
# Error típico de CSRF
[CSRF] Token mismatch
[CSRF] Token missing
[CSRF] Token invalid or expired
```

## 📋 Checklist de Verificación

- [ ] Variable `CSRF_SECRET` configurada (mínimo 32 caracteres)
- [ ] Variable `CSRF_COOKIE_DOMAIN` configurada si usas subdominios
- [ ] Todos los dominios usan HTTPS en producción
- [ ] Certificados SSL válidos
- [ ] Cookie `csrf-token` visible en DevTools
- [ ] Header `X-CSRF-Token` presente en requests
- [ ] No hay errores de CORS en la consola

## 🔗 Referencias

- **Código CSRF**: `src/lib/security/csrf-protection.ts`
- **Configuración**: `.env.example` (líneas 61-77)
- **Middleware**: `middleware.ts`
- **API Routes**: `src/app/api/admin/site-status/route.ts`

## 💡 Notas Adicionales

- **Desarrollo Local**: No necesitas configurar `CSRF_COOKIE_DOMAIN`
- **Staging/Production**: Configura según tu arquitectura de dominios
- **Seguridad**: Nunca deshabilites CSRF - es una protección crítica
- **Cookies**: Las cookies CSRF expiran en 24 horas

