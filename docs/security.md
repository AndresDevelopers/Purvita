# Seguridad y cumplimiento

El objetivo es equilibrar la flexibilidad del panel administrativo con la proteccion de datos en Supabase y el frontend de Next.js.

## Autenticacion y clientes Supabase

- **Cliente publico** (`src/lib/supabase.ts`): se usa en componentes cliente, respeta Row Level Security.
- **Cliente admin** (`getAdminClient()` en `src/lib/services/user-service.ts` y rutas API): usa `SUPABASE_SERVICE_ROLE_KEY`, por lo que debe ejecutarse solo en el servidor.
- Nunca envuelvas el cliente admin en componentes con `'use client'`.

## Control de acceso

- Las rutas bajo `/admin` deben validarse contra el rol `admin` almacenado en la tabla `profiles`.
- `admin-guard.tsx` contiene el esqueleto para reforzar la proteccion; integra aqui las comprobaciones de session de Supabase.

## Row Level Security

- `docs/database/full-schema.sql` (SECTION: Core schema and RLS) habilita RLS en `profiles` e incluye politicas para lectura y actualizacion del propio usuario.
- Para tareas administrativas, el cliente de servicio bypassa RLS de forma segura porque las credenciales solo viven en el backend.
- Si requieres acceso total temporal para diagnostico, usa el bloque opcional "Temporary full-access policy" incluido al final de `docs/database/full-schema.sql` y revierte los cambios cuando termines.

## Validacion y sanitizacion

- Todas las entradas se validan con Zod antes de persistir (ver `UpdateUserProfileSchema` y `ProductSchema`).
- Errores de Supabase se encapsulan y se devuelven con mensajes genericos (`src/app/api/admin/users/route.ts`).
- Las imagenes se suben con nombres generados (`${productId}/${timestamp}.ext`) para evitar colisiones.

## Variables de entorno sensibles

- `SUPABASE_SERVICE_ROLE_KEY` debe configurarse solo en servidores.
- Las credenciales de Stripe y PayPal residen cifradas en la tabla `payment_gateways`; verifica que solo las rutas server-side tengan acceso a ellas.
- Agrega validaciones en tiempo de arranque para evitar despliegues sin claves (por ejemplo, `if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw ...`).

## Auditoria y trazabilidad

- `src/lib/services/audit-log-service.ts` ofrece una base para registrar acciones criticas; conectalo en rutas PUT/POST/DELETE.
- Loguea `userId`, accion, target y timestamp.
- **Encriptación de IPs**: Las direcciones IP se encriptan automáticamente con AES-256-GCM antes de almacenarse en audit logs para proteger la privacidad del usuario (GDPR/CCPA compliance).
- Ver `docs/ip-encryption.md` para detalles completos sobre encriptación de IPs.

## Medidas de seguridad implementadas

### 1. Cookies seguras (HttpOnly)

- Todas las cookies de sesión incluyen el flag `HttpOnly` para prevenir acceso desde JavaScript (protección XSS)
- Las cookies se configuran con `SameSite=Lax` para protección CSRF
- En producción (HTTPS), se activa automáticamente el flag `Secure`

**Implementación**: Ver `src/lib/auth/session-cookies.ts`

### 2. Headers de seguridad

Las siguientes cabeceras de seguridad están configuradas en producción:

- **Content-Security-Policy (CSP)**: Controla qué recursos pueden cargarse, previniendo XSS
- **Strict-Transport-Security (HSTS)**: Fuerza conexiones HTTPS por 2 años
- **X-Frame-Options**: Previene clickjacking
- **X-Content-Type-Options**: Previene MIME sniffing
- **Referrer-Policy**: Controla información de referrer enviada

**Implementación**: Ver `next.config.ts`

### 3. Rate limiting

**IMPORTANTE**: La configuración de rate limiting ahora se gestiona desde **Admin → Security → Rate Limit**.

Los cambios se aplican en tiempo real sin necesidad de reiniciar el servidor. Las variables de entorno solo se usan como fallback.

#### Rate limiting general (API)

- Configura desde el Admin Panel o usa variables de entorno `API_RATE_LIMIT_REQUESTS` y `API_RATE_LIMIT_WINDOW_MS` como fallback
- El fingerprint de cliente se deriva de IP + `User-Agent` (hash SHA-256) respetando privacidad y soportando proxies comunes (`x-forwarded-for`, `x-real-ip`)
- Las respuestas incluyen `X-RateLimit-*` y `Retry-After` cuando aplica
- Default: 60 solicitudes por minuto

**Implementación**: Ver `middleware.ts` y `src/lib/helpers/rate-limit-config-helper.ts`

**Documentación completa**: Ver `docs/RATE_LIMIT_CONFIGURATION.md`

#### Rate limiting de login

- Protección específica contra ataques de fuerza bruta en el endpoint de login
- Configurable via `LOGIN_RATE_LIMIT_ATTEMPTS` y `LOGIN_RATE_LIMIT_WINDOW_SECONDS`
- Default: 5 intentos por minuto por IP
- Después de exceder el límite, el usuario debe esperar que expire la ventana de tiempo

**Implementación**: Ver `src/app/api/auth/login/route.ts`
**Documentación**: Ver `docs/LOGIN_RATE_LIMITING.md`

### 4. Verificación de firma de webhooks

#### PayPal

- Verificación de firma usando PayPal Webhook Verification API
- Requiere configurar `PAYPAL_WEBHOOK_ID` en variables de entorno
- Sin este ID, los webhooks funcionan pero muestran advertencia de seguridad
- Previene webhooks fraudulentos y ataques de replay

#### Stripe

- Verificación de firma usando `stripe.webhooks.constructEvent()`
- Usa el secret del webhook configurado en Stripe Dashboard
- Rechaza automáticamente webhooks con firma inválida

**Implementación**:

- PayPal: `src/app/api/webhooks/paypal/route.ts`
- Stripe: `src/app/api/webhooks/stripe/route.ts`

**Documentación**: Ver `docs/WEBHOOKS_AND_CORS.md`

### 5. CORS configurable

- CORS deshabilitado por defecto (más seguro)
- Configurable via `ALLOWED_CORS_ORIGINS` (lista separada por comas)
- Solo permite orígenes explícitamente whitelisted
- Incluye soporte para preflight requests (OPTIONS)

**Implementación**: Ver `src/lib/utils/cors.ts` y `middleware.ts`
**Documentación**: Ver `docs/WEBHOOKS_AND_CORS.md`

### 6. Protección de endpoints CRON

- Los endpoints de tareas programadas requieren header `Authorization: Bearer ${CRON_SECRET}`
- Previene ejecución no autorizada de tareas críticas
- El secret debe generarse con alta entropía

**Documentación**: Ver `docs/CRON_SECRET_SETUP.md`

## Recomendaciones adicionales

1. **MFA para usuarios admin**: Forzar autenticación de dos factores via Supabase Auth
2. **Audit logs en base de datos**: Registrar cambios en `profiles` y `products` mediante triggers
3. **Monitoreo con Sentry**: Configurar alertas para errores críticos y eventos de seguridad
4. **Rotación de secrets**: Rotar `CRON_SECRET` y otros secrets periódicamente
5. **Backups automáticos**: Configurar backups diarios de Supabase

## Referencias

### Código

- `src/app/api/admin/users/[id]/route.ts`
- `src/lib/services/user-service.ts`
- `middleware.ts`
- `src/lib/auth/session-cookies.ts`
- `src/lib/utils/cors.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/webhooks/paypal/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `next.config.ts`

### Base de datos

- `docs/database/full-schema.sql`

### Documentación de seguridad

- `docs/AUDITORIA_SEGURIDAD.md` - Reporte completo de auditoría de seguridad
- `docs/SECURITY_IMPROVEMENTS_APPLIED.md` - Resumen de mejoras implementadas
- `docs/LOGIN_RATE_LIMITING.md` - Configuración de rate limiting de login
- `docs/CRON_SECRET_SETUP.md` - Configuración de CRON_SECRET
- `docs/WEBHOOKS_AND_CORS.md` - Configuración de webhooks y CORS
- `docs/environment-variables.md` - Variables de entorno y configuración
