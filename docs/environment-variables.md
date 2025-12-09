# Guía de Variables de Entorno

## Resumen

Este proyecto utiliza el sistema nativo de Next.js para la gestión de variables de entorno. **No se requiere configuración adicional** - Next.js maneja automáticamente la carga de archivos `.env` según el entorno de ejecución.

## Comportamiento por Entorno

### Desarrollo (`npm run dev`)

Next.js carga automáticamente las variables en el siguiente orden de prioridad (de mayor a menor):

1. `.env.development.local` (específico para desarrollo local, ignorado por git)
2. `.env.local` **(RECOMENDADO para desarrollo)**
3. `.env.development` (valores por defecto para desarrollo)
4. `.env` (valores por defecto para todos los entornos)

**Recomendación**: Usa `.env.local` para tu configuración de desarrollo local. Este archivo debe estar en `.gitignore` para evitar compartir credenciales.

### Producción (`npm run build` y `npm start`)

Next.js carga automáticamente las variables en el siguiente orden de prioridad:

1. `.env.production.local` (específico para producción local)
2. `.env.local` (valores locales que sobrescriben producción)
3. `.env.production` (valores por defecto para producción)
4. `.env` (valores por defecto para todos los entornos)

**Recomendación para despliegues**:

- En plataformas como Vercel, Railway, o similares: configura las variables directamente en el panel de la plataforma
- En servidores propios: usa un archivo `.env` o `.env.production` en el servidor

## Tipos de Variables

### Variables Públicas (Cliente)

Variables que comienzan con `NEXT_PUBLIC_` están disponibles en el navegador:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

⚠️ **Importante**: Estas variables se incluyen en el bundle del cliente y son visibles públicamente. **Nunca incluyas secretos aquí**.

### Variables Privadas (Servidor)

Variables sin el prefijo `NEXT_PUBLIC_` solo están disponibles en el servidor:

```env
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
```

✅ Estas variables son seguras y nunca se exponen al cliente.

⚠️ **Importante sobre `SUPABASE_SERVICE_ROLE_KEY`**:

- Esta variable es **opcional** en el esquema de validación de `src/lib/env.ts`
- Esto es intencional para evitar errores cuando módulos que importan `env.ts` se usan en componentes del cliente
- Sin embargo, **es requerida** para que funcionen las operaciones del servidor (API routes, server components)
- Asegúrate de tenerla configurada en tu `.env.local` para desarrollo

## Configuración Inicial

### 1. Crear archivo de desarrollo

```bash
# Copia el archivo de ejemplo
cp .env.example .env.local

# Edita el archivo con tus credenciales
# Usa tu editor favorito para completar los valores
```

### 2. Variables Requeridas Mínimas

Para que la aplicación funcione, necesitas al menos:

```env
# Configuración de la App
NEXT_PUBLIC_APP_NAME="PūrVita"

# Supabase (obligatorio)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# App URL (opcional en desarrollo, requerido en producción)
NEXT_PUBLIC_APP_URL=http://localhost:9000
```

### 3. Variables Opcionales

Dependiendo de las funcionalidades que uses:

```env
# Email transaccional
RESEND_API_KEY=re_...
CONTACT_FROM_EMAIL=contact@example.com
CONTACT_FROM_NAME="PūrVita Support"
CONTACT_REPLY_TO_EMAIL=
CONTACT_SUBJECT_PREFIX="[PurVita Contact]"

# Mailchimp
MAILCHIMP_API_KEY=tu-api-key
MAILCHIMP_AUDIENCE_ID=tu-audience-id

# Upstash Redis (caché y rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Sentry (monitoreo y observabilidad)
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_DSN=https://...
SENTRY_ORG=tu-organizacion
SENTRY_PROJECT=tu-proyecto
SENTRY_AUTH_TOKEN=...
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.2
SENTRY_TRACES_SAMPLE_RATE=0.2
NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1

# Seguridad y Rate Limiting (OPCIONAL - Se configura desde Admin Panel)
# Estas variables son opcionales. La configuración se gestiona desde Admin → Security → Rate Limit
# Solo se usan como fallback si la base de datos no está disponible
API_RATE_LIMIT_REQUESTS=60
API_RATE_LIMIT_WINDOW_MS=60000
LOGIN_RATE_LIMIT_ATTEMPTS=5
LOGIN_RATE_LIMIT_WINDOW_SECONDS=60
AUTO_BLOCK_ENABLED=true
AUTO_BLOCK_DURATION_HOURS=24
AUTO_BLOCK_MIN_CONFIDENCE=70

# Seguridad - Otros
CRON_SECRET=tu-cron-secret-aqui

# Encriptación y Seguridad
CUSTOM_ID_SECRET=genera-con-openssl-rand-hex-32

# CORS (Cross-Origin Resource Sharing)
ALLOWED_CORS_ORIGINS=https://example.com,https://app.example.com

# Pasarelas de Pago - PayPal Producción
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_CONNECT_CLIENT_ID=

# Pasarelas de Pago - PayPal Test/Sandbox
PAYPAL_TEST_CLIENT_ID=
PAYPAL_TEST_CLIENT_SECRET=
PAYPAL_TEST_WEBHOOK_SECRET=
PAYPAL_TEST_CONNECT_CLIENT_ID=

# Pasarelas de Pago - Stripe Producción
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=

# Pasarelas de Pago - Stripe Test
NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=
STRIPE_TEST_SECRET_KEY=
STRIPE_TEST_WEBHOOK_SECRET=
STRIPE_TEST_CONNECT_CLIENT_ID=
```

### Variables de Seguridad Detalladas

#### Rate Limiting General (API) - OPCIONAL

**IMPORTANTE**: Estas variables son **opcionales**. La configuración se gestiona desde **Admin → Security → Rate Limit**.

Las variables de entorno solo se usan como fallback si la base de datos no está disponible.

- **`API_RATE_LIMIT_REQUESTS`**: Número máximo de solicitudes permitidas por ventana de tiempo (default: 60)
- **`API_RATE_LIMIT_WINDOW_MS`**: Ventana de tiempo en milisegundos para el rate limiting (default: 60000 = 1 minuto)

Estas variables controlan el rate limiting global para todos los endpoints de la API. Si un cliente excede el límite, recibirá un error 429 (Too Many Requests).

**Recomendación**: Configura estos valores desde el Admin Panel para cambios en tiempo real sin reiniciar el servidor.

#### Rate Limiting de Login - OPCIONAL

**IMPORTANTE**: Estas variables son **opcionales**. La configuración se gestiona desde **Admin → Security → Rate Limit**.

Las variables de entorno solo se usan como fallback si la base de datos no está disponible.

- **`LOGIN_RATE_LIMIT_ATTEMPTS`**: Número máximo de intentos de login permitidos (default: 5)
- **`LOGIN_RATE_LIMIT_WINDOW_SECONDS`**: Ventana de tiempo en segundos para intentos de login (default: 60)

Estas variables protegen contra ataques de fuerza bruta en el login. Después de exceder los intentos, el usuario debe esperar que expire la ventana de tiempo antes de intentar nuevamente.

**Recomendación**: Configura estos valores desde el Admin Panel para cambios en tiempo real sin reiniciar el servidor.

**Documentación completa**: Ver `docs/RATE_LIMIT_CONFIGURATION.md`

#### Auto-Block Configuration - OPCIONAL

**IMPORTANTE**: Estas variables son **opcionales**. La configuración se gestiona desde **Admin → Security → Rate Limit → Auto-Block**.

Las variables de entorno solo se usan como fallback si la base de datos no está disponible.

- **`AUTO_BLOCK_ENABLED`**: Habilitar/deshabilitar bloqueo automático de IPs maliciosas (default: true)
- **`AUTO_BLOCK_DURATION_HOURS`**: Duración en horas del bloqueo automático (default: 24)
- **`AUTO_BLOCK_MIN_CONFIDENCE`**: Nivel mínimo de confianza (0-100) para activar auto-bloqueo (default: 70)

**Recomendación**: Configura estos valores desde el Admin Panel para cambios en tiempo real sin reiniciar el servidor.

#### CRON Secret

- **`CRON_SECRET`**: Token secreto para autenticar solicitudes de tareas programadas

Este secret protege los endpoints de cron jobs para que solo servicios autorizados puedan ejecutarlos. **Requerido en producción**.

**Documentación completa**: Ver `docs/CRON_SECRET_SETUP.md`

#### CORS (Cross-Origin Resource Sharing)

- **`ALLOWED_CORS_ORIGINS`**: Lista separada por comas de orígenes permitidos para CORS

Ejemplo: `https://example.com,https://app.example.com`

Si no se configura o está vacío, CORS estará deshabilitado (más seguro). Solo configura esto si necesitas permitir solicitudes desde otros dominios.

**Documentación completa**: Ver `docs/WEBHOOKS_AND_CORS.md`

#### Webhooks de Pagos

- **`PAYPAL_WEBHOOK_ID`**: ID del webhook de PayPal para verificación de firma

Este ID se obtiene desde el Dashboard de PayPal al crear un webhook. Es **crítico para seguridad** ya que verifica que los eventos de webhook realmente provienen de PayPal y no de un atacante.

**Sin este ID configurado**: Los webhooks de PayPal funcionarán pero sin verificación de firma (solo recomendado para desarrollo).

**Documentación completa**: Ver `docs/WEBHOOKS_AND_CORS.md`

#### Encriptación y Seguridad

- **`CUSTOM_ID_SECRET`**: Clave secreta para encriptar metadata en custom IDs de PayPal

Esta clave debe generarse usando:

```bash
openssl rand -hex 32
```

**`CUSTOM_ID_SECRET`** debe ser exactamente 64 caracteres hexadecimales (32 bytes). Se usa para encriptar información sensible en los custom IDs de transacciones de PayPal, proporcionando una capa adicional de seguridad.

⚠️ **NUNCA cambiar en producción** o perderás acceso a transacciones en curso.

#### Configuración de Pasarelas de Pago

**IMPORTANTE**: Todas las credenciales de pago se configuran desde variables de entorno. El panel `/admin/pays` **solo permite**:

- Activar/Desactivar métodos de pago
- Seleccionar funcionalidad: `payment` (recibir) | `payout` (enviar) | `both` (ambos)
- Seleccionar modo: `production` (live) | `test` (sandbox)

##### PayPal

**Producción (Live)**:

- **`PAYPAL_CLIENT_ID`**: Client ID de tu app de PayPal en producción
- **`PAYPAL_CLIENT_SECRET`**: Client Secret de tu app de PayPal en producción
- **`PAYPAL_WEBHOOK_SECRET`**: Webhook Secret para verificar eventos de PayPal
- **`PAYPAL_WEBHOOK_ID`**: ID del webhook (opcional pero recomendado para validación)
- **`PAYPAL_CONNECT_CLIENT_ID`**: (Opcional) Para PayPal Connect - permite a usuarios conectar sus cuentas

**Test/Sandbox**:

- **`PAYPAL_TEST_CLIENT_ID`**: Client ID de sandbox
- **`PAYPAL_TEST_CLIENT_SECRET`**: Client Secret de sandbox
- **`PAYPAL_TEST_WEBHOOK_SECRET`**: Webhook Secret de sandbox
- **`PAYPAL_TEST_CONNECT_CLIENT_ID`**: (Opcional) Connect Client ID de sandbox

**Cómo obtener credenciales**:

1. Ir a: [https://developer.paypal.com/dashboard/](https://developer.paypal.com/dashboard/)
2. Crear una app o seleccionar una existente
3. Copiar Client ID y Secret desde "App Credentials"
4. Para webhooks: Ir a "Webhooks" y copiar el Webhook Secret y Webhook ID
5. Para PayPal Connect: Configurar en "Partner Referrals"

##### Stripe

**Producción (Live)**:

- **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**: Publishable key (pk_live_xxx) - Debe tener prefijo NEXT_PUBLIC_
- **`STRIPE_SECRET_KEY`**: Secret key (sk_live_xxx)
- **`STRIPE_WEBHOOK_SECRET`**: Webhook signing secret (whsec_xxx)
- **`STRIPE_CONNECT_CLIENT_ID`**: (Opcional) Para Stripe Connect - permite a usuarios conectar sus cuentas (ca_xxx)

**Test**:

- **`NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY`**: Publishable key de test (pk_test_xxx) - Debe tener prefijo NEXT_PUBLIC_
- **`STRIPE_TEST_SECRET_KEY`**: Secret key de test (sk_test_xxx)
- **`STRIPE_TEST_WEBHOOK_SECRET`**: Webhook signing secret de test (whsec_test_xxx)
- **`STRIPE_TEST_CONNECT_CLIENT_ID`**: (Opcional) Connect Client ID de test (ca_test_xxx)

**Cómo obtener credenciales**:

1. Ir a: [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Copiar Publishable key y Secret key
3. Para webhooks: Ir a "Developers > Webhooks" y copiar el Signing secret
4. Para Stripe Connect: Ir a "Settings > Connect" y copiar el Client ID

##### Wallet y Manual

- **Wallet (Billetera Interna)**: No requiere credenciales externas. Se activa/desactiva desde `/admin/pays`
- **Manual (Depósito Manual)**: No requiere credenciales externas. Configurar métodos de depósito desde `/admin/payment-wallets`

##### Funcionalidad de Métodos de Pago

Cada método de pago puede configurarse para:

- **`payment`**: Solo recibir pagos de clientes (checkout, suscripciones)
- **`payout`**: Solo realizar pagos a usuarios (retiros, comisiones, reembolsos)
- **`both`**: Ambas funcionalidades habilitadas

##### Modos de Operación

- **`production`**: Usa credenciales de producción (PAYPAL_CLIENT_ID, STRIPE_SECRET_KEY, etc.)
- **`test`**: Usa credenciales de test (PAYPAL_TEST_CLIENT_ID, STRIPE_TEST_SECRET_KEY, etc.)

El modo se selecciona desde `/admin/pays` para cada método de pago. Esto permite tener PayPal en producción y Stripe en test simultáneamente, por ejemplo.

#### Configuración de Email

Variables para personalizar los emails enviados desde la aplicación:

- **`CONTACT_FROM_EMAIL`**: Email del remitente (requerido)
- **`CONTACT_FROM_NAME`**: Nombre del remitente (default: "PūrVita Support")
- **`CONTACT_REPLY_TO_EMAIL`**: Email para respuestas (opcional)
- **`CONTACT_SUBJECT_PREFIX`**: Prefijo para asuntos de emails (default: "[PurVita Contact]")

Estas variables permiten personalizar la experiencia de email sin modificar código.

#### Configuración de Sentry

Variables para monitoreo y observabilidad con Sentry:

- **`NEXT_PUBLIC_SENTRY_DSN`**: DSN público para el cliente
- **`SENTRY_DSN`**: DSN para el servidor
- **`SENTRY_ORG`**: Nombre de tu organización en Sentry
- **`SENTRY_PROJECT`**: Nombre del proyecto en Sentry
- **`SENTRY_AUTH_TOKEN`**: Token de autenticación para subir source maps

**Sampling rates** (valores entre 0 y 1):

- **`NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`**: Porcentaje de transacciones a rastrear en cliente (default: 0.2 = 20%)
- **`SENTRY_TRACES_SAMPLE_RATE`**: Porcentaje de transacciones a rastrear en servidor (default: 0.2 = 20%)
- **`NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`**: Porcentaje de sesiones a grabar (default: 0.1 = 10%)
- **`NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`**: Porcentaje de sesiones con errores a grabar (default: 1 = 100%)

Los sampling rates más bajos reducen costos pero proporcionan menos datos de monitoreo.

## Verificación de Variables

El proyecto incluye validación automática de variables de entorno en `src/lib/env.ts`:

```typescript
import { getEnv } from '@/lib/env';

// Esto lanzará un error si faltan variables requeridas
const env = getEnv();
```

Si faltan variables requeridas, verás un error claro en la consola indicando cuáles faltan.

## Mejores Prácticas

### ✅ Hacer

1. **Usa `.env.local` para desarrollo**: Este archivo está en `.gitignore` y es perfecto para tus credenciales locales
2. **Documenta nuevas variables en `.env.example`**: Cuando agregues una nueva variable, actualiza el archivo de ejemplo
3. **Usa variables públicas solo cuando sea necesario**: Solo usa `NEXT_PUBLIC_` para valores que realmente necesitan estar en el cliente
4. **Configura variables en la plataforma de hosting**: Para producción, usa el panel de tu plataforma (Vercel, Railway, etc.)

### ❌ Evitar

1. **No commits `.env.local` o `.env`**: Estos archivos contienen credenciales y no deben estar en git
2. **No uses valores hardcodeados**: Siempre usa variables de entorno para configuración sensible
3. **No expongas secretos con `NEXT_PUBLIC_`**: Las claves secretas nunca deben tener este prefijo
4. **No edites variables en producción directamente**: Usa el panel de tu plataforma de hosting

## Solución de Problemas

### Variables no se cargan en desarrollo

1. Verifica que el archivo `.env.local` existe en la raíz del proyecto
2. Reinicia el servidor de desarrollo (`npm run dev`)
3. Verifica que las variables tienen el formato correcto: `NOMBRE=valor` (sin espacios alrededor del `=`)

### Variables no se cargan en producción

1. Verifica que las variables están configuradas en tu plataforma de hosting
2. Para Vercel: ve a Settings → Environment Variables
3. Para otros servicios: consulta la documentación de tu plataforma
4. Asegúrate de hacer redeploy después de cambiar variables

### Error "Missing environment variables"

Este error indica que faltan variables requeridas. Revisa:

1. El mensaje de error te dirá exactamente qué variables faltan
2. Compara tu `.env.local` con `.env.example`
3. Asegúrate de que las variables requeridas están definidas

## Archivos de Entorno en el Proyecto

```text
.
├── .env.example          # Plantilla con todas las variables (commiteado)
├── .env.local           # Tu configuración local (NO commiteado)
├── .env                 # Valores por defecto (opcional, NO commiteado)
└── .env.sentry-build-plugin  # Configuración de Sentry (generado automáticamente)
```

## Referencias

- [Documentación oficial de Next.js sobre variables de entorno](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- Ver `src/lib/env.ts` para la validación de variables
- Ver `src/lib/config/environment.ts` para la configuración de Supabase
- Ver `.env.example` para la lista completa de variables disponibles
- Ver `docs/redis-setup.md` para la configuración de Upstash Redis

### Documentación de Seguridad

- Ver `docs/AUDITORIA_SEGURIDAD.md` para el reporte completo de auditoría de seguridad
- Ver `docs/SECURITY_IMPROVEMENTS_APPLIED.md` para el resumen de mejoras implementadas
- Ver `docs/LOGIN_RATE_LIMITING.md` para configuración de rate limiting de login
- Ver `docs/CRON_SECRET_SETUP.md` para configuración de CRON_SECRET
- Ver `docs/WEBHOOKS_AND_CORS.md` para configuración de webhooks y CORS
