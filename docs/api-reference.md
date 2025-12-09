# Referencia de API

Las rutas API se implementan con el App Router de Next.js y responden en JSON. Los endpoints administrativos requieren el uso del cliente de servicio de Supabase (service role) y deben invocarse desde el backend.

## Rate limiting global
- **Cabeceras**: Todas las respuestas incluyen `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` y, en caso de bloqueo, `Retry-After` (segundos).
- **Errores 429**: El payload de error entrega mensajes en inglés (`error`) y español (`error_es`) para facilitar UX multilingüe.
- **Configuración**: Se gestiona desde **Admin → Security → Rate Limit** para cambios en tiempo real. Las variables de entorno `API_RATE_LIMIT_REQUESTS` y `API_RATE_LIMIT_WINDOW_MS` solo se usan como fallback (default: 60 req/min).
- **Rate limiting de login**: Los endpoints de autenticación tienen límites más estrictos configurables desde el Admin Panel. Las variables de entorno `LOGIN_RATE_LIMIT_ATTEMPTS` y `LOGIN_RATE_LIMIT_WINDOW_SECONDS` solo se usan como fallback (default: 5 intentos/min) para proteger contra ataques de fuerza bruta.
- **Documentación completa**: Ver `docs/RATE_LIMIT_CONFIGURATION.md`

**Documentación detallada**: Ver `docs/LOGIN_RATE_LIMITING.md`

## Health check
- **Metodo**: GET
- **Ruta**: `/api/health`
- **Descripcion**: Verifica que la app este viva. Retorna `{ status: "ok" }`.
- **Archivo**: `src/app/api/health/route.ts`

## Autenticación - Login
- **Metodo**: POST
- **Ruta**: `/api/auth/login`
- **Body**: `{ "email": string, "password": string }` (validado con Zod).
- **Descripción**: Endpoint de autenticación con protección de rate limiting contra ataques de fuerza bruta. Valida credenciales con Supabase Auth y retorna sesión.
- **Rate Limiting**: Configurable via `LOGIN_RATE_LIMIT_ATTEMPTS` y `LOGIN_RATE_LIMIT_WINDOW_SECONDS` (default: 5 intentos por minuto por IP).
- **Respuestas**:
  - 200: `{ success: true, session, remainingAttempts }` - Login exitoso.
  - 401: `{ error: 'Invalid credentials', remainingAttempts }` - Credenciales incorrectas.
  - 429: `{ error: 'Too many login attempts', remainingAttempts: 0 }` - Rate limit excedido. Incluye header `Retry-After` con segundos de espera.
  - 400: `{ error: 'Invalid request data', details }` - Datos de entrada inválidos.
  - 500: `{ error: 'Internal server error' }` - Error inesperado.
- **Headers de respuesta**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, y `Retry-After` (cuando aplica).
- **Archivo**: `src/app/api/auth/login/route.ts`
- **Documentación**: Ver `docs/LOGIN_RATE_LIMITING.md`

## Admin - Listado de usuarios
- **Metodo**: GET
- **Ruta**: `/api/admin/users`
- **Autenticacion**: requiere `SUPABASE_SERVICE_ROLE_KEY` (solo desde el servidor).
- **Respuesta 200**: lista de perfiles (estructura `UserProfileSchema`).
- **Errores**:
  - 400 si Supabase regresa error (`{ error: string }`).
  - 500 ante excepciones inesperadas.
- **Archivo**: `src/app/api/admin/users/route.ts`

## Admin - Perfil especifico
- **Metodo**: GET
- **Ruta**: `/api/admin/users/:id`
- **Parametros**: `id` UUID.
- **Autenticacion**: requiere cliente admin (service role).
- **Respuestas**:
  - 200: perfil completo.
  - 404: `{ error: "User not found" }` cuando Supabase devuelve `PGRST116`.
  - 400/500: errores de datos o internos.
- **Archivo**: `src/app/api/admin/users/[id]/route.ts`

## Admin - Actualizacion de perfil
- **Metodo**: PUT
- **Ruta**: `/api/admin/users/:id`
- **Body**: JSON validado por `UpdateUserProfileSchema`.
- **Autenticacion**: cliente admin (service role).
- **Respuestas**:
  - 200: perfil actualizado.
  - 400: error de validacion o Supabase (`Error updating user: ...`).
  - 404: perfil inexistente.
  - 500: errores no controlados.
- **Archivo**: `src/app/api/admin/users/[id]/route.ts`

## Admin - Impersonacion de usuario
- **Metodo**: POST
- **Ruta**: `/api/admin/users/:id/impersonate`
- **Parametros**: `id` UUID.
- **Query opcional**:
  - `lang`: locale (`en`, `es`, etc.) usado para definir el dashboard destino.
  - `redirect`: ruta absoluta (comenzando con `/`) para enviar al administrador luego de validar el enlace mágico.
- **Descripcion**: Genera un enlace de acceso temporal usando Supabase Auth para que un administrador ingrese como el usuario. Registra auditoría `ADMIN_IMPERSONATE_USER`.
- **Autenticacion**: requiere cliente admin (service role) y sesión administrativa válida.
- **Respuestas**:
  - 200: `{ url, redirectTo }` con el enlace de Supabase.
  - 404: usuario inexistente.
  - 422: el perfil no tiene correo electrónico válido.
  - 500: errores inesperados al generar el enlace.
- **Archivo**: `src/app/api/admin/users/[id]/impersonate/route.ts`

## Admin - Pasarelas de pago
- **Metodo**: GET
- **Ruta**: `/api/admin/payments`
- **Descripcion**: Devuelve la configuracion de PayPal y Stripe. Respuesta validada con `PaymentGatewaySettingsSchema[]`.
- **Autenticacion**: requiere cliente admin (service role).
- **Errores**:
  - 500 si falla la comunicacion con Supabase.
- **Archivo**: `src/app/api/admin/payments/route.ts`

- **Metodo**: PUT
- **Ruta**: `/api/admin/payments`
- **Body**: JSON validado con `PaymentGatewayUpdateInputSchema`.
- **Descripcion**: Actualiza/crea la configuracion de un proveedor. Registra auditoria (`PAYMENT_GATEWAY_UPDATED`).
- **Respuestas**:
  - 200: configuracion guardada (`PaymentGatewaySettingsSchema`).
  - 400: errores de validacion (estructura Zod).
  - 500: errores inesperados.
- **Archivo**: `src/app/api/admin/payments/route.ts`

## Publico - Pasarelas activas
- **Metodo**: GET
- **Ruta**: `/api/payments/providers`
- **Descripcion**: Lista los proveedores activos y expone solo datos publicos (clientId/publishableKey). Valida con `PaymentGatewayPublicInfoSchema[]`.
- **Autenticacion**: no requerida (lectura publica condicionada por RLS `is_active = true`).
- **Errores**:
  - 500 si Supabase devuelve error.
- **Archivo**: `src/app/api/payments/providers/route.ts`

## Publico - Suscripcion Mailchimp (registro)
- **Metodo**: POST
- **Ruta**: `/api/auth/mailchimp-subscribe`
- **Body**: `{ "email": string, "name"?: string }`.
- **Descripcion**: Normaliza el payload de registro, adjunta la etiqueta `registration` y envia la solicitud a Mailchimp usando `subscribeToMailchimp`.
- **Autenticacion**: no requerida; se valida mediante rate limiting global y configuraciones de Mailchimp (`MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID`).
- **Respuestas**:
  - 200: `{ success: true }` o `{ success: false, error }`. Incluso los fallos retornan 200 para no bloquear el flujo de registro; revisar logs para diagnosticar.
  - 400: `{ error: 'Email is required' }` cuando no se envía correo.
- **Archivo**: `src/app/api/auth/mailchimp-subscribe/route.ts`

## Publico - Lista de espera (Coming soon)
- **Metodo**: POST
- **Ruta**: `/api/site-status/coming-soon/subscribe`
- **Body**: `{ "email": string }` (validado con Zod).
- **Descripcion**: Inscribe correos en la lista de espera cuando el sitio está en modo `coming_soon`. Requiere que en `/admin/site-status` se habilite Mailchimp y se configuren `audienceId` + `serverPrefix`.
- **Respuestas**:
  - 200: `{ status: 'subscribed' | 'already_subscribed' }` según la respuesta de Mailchimp.
  - 400: `{ error: 'invalid_request', details }` si el email no es válido.
  - 409: `{ error: 'coming_soon_inactive' }` cuando el modo coming soon no está activo.
  - 502: `{ error: 'mailchimp_error', message }` si Mailchimp rechaza la solicitud.
  - 503: `{ error: 'configuration_missing', message }` si faltan datos de configuración.
  - 500: `{ error: 'internal_error' }` para fallos inesperados.
- **Archivo**: `src/app/api/site-status/coming-soon/subscribe/route.ts`

## Publico - Resolver codigo de referido
- **Metodo**: POST
- **Ruta**: `/api/referrals/resolve`
- **Body**: `{ "input": string }` donde `input` acepta el codigo crudo, un UUID o una URL completa con `?sponsor=`/`?ref=`.
- **Descripcion**: Normaliza el valor recibido, consulta el perfil del patrocinador y devuelve `{ sponsorId, normalizedCode, referralCode, sponsor }`.
- **Autenticacion**: no requerida, protegido por rate limiting y politicas RLS.
- **Respuestas**:
  - 200: sponsor encontrado (`referralCode` puede ser `null` si el patrocinador aun no lo define).
  - 400: payload invalido o codigo vacio (`{ error, code: "invalid_input" }`).
  - 404: no existe patrocinador para el codigo (`{ error, code: "not_found" }`).
  - 429: excedio limite de peticiones (usa cabeceras `Retry-After`).
  - 500: errores inesperados o credenciales insuficientes.
- **Archivo**: `src/app/api/referrals/resolve/route.ts`

## Perfil - Disponibilidad de codigo de referido
- **Metodo**: POST
- **Ruta**: `/api/profile/referral/availability`
- **Body**: `{ "referral_code": string }` (permite cadena vacia para limpiar el codigo).
- **Cabeceras**: `x-user-id` con el UUID del usuario autenticado.
- **Descripcion**: Normaliza y valida el codigo propuesto, verifica colisiones en Supabase excluyendo al propio usuario y devuelve `{ available, normalized, reason }` para actualizar la UI en tiempo real.
- **Respuestas**:
  - 200: payload `{ available: boolean, normalized: string | null, reason: 'ok' | 'empty' | 'referral_code_pattern' | 'referral_code_min_length' | 'referral_code_max_length' | 'referral_code_conflict' }`.
  - 400: falta cabecera `x-user-id` o JSON invalido.
  - 500: error inesperado al consultar Supabase.
- **Archivo**: `src/app/api/profile/referral/availability/route.ts`

## Reglas generales
- Las rutas admin nunca deben ser llamadas desde el navegador; usa fetches server-side o desde acciones protegidas.
- Las respuestas de error siempre incluyen un campo `error` para facilitar manejo.
- Para endpoints adicionales, sigue los mismos patrones de cliente admin y validacion con Zod.

## Roadmap sugerido
- Agregar `POST /api/admin/products` y versiones `PUT/DELETE` para CRUD completo via API.
- Implementar paginacion y filtros en `/api/admin/users`.
- Incorporar autenticacion basada en JWT o Supabase Auth Helpers antes de exponer endpoints a clientes externos.

## Referencias

### Código
- `src/app/api/*/route.ts` - Implementaciones de endpoints
- `src/lib/models/definitions.ts` - Definiciones de modelos y schemas Zod
- `src/lib/services/user-service.ts` - Servicios de usuario
- `middleware.ts` - Rate limiting y CORS global
- `src/lib/utils/cors.ts` - Utilidades CORS

### Documentación
- `docs/environment-variables.md` - Variables de entorno y configuración
- `docs/security.md` - Seguridad y mejores prácticas
- `docs/LOGIN_RATE_LIMITING.md` - Rate limiting de login
- `docs/WEBHOOKS_AND_CORS.md` - Webhooks y CORS
- `docs/AUDITORIA_SEGURIDAD.md` - Auditoría de seguridad completa
