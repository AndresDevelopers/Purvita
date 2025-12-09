# Modelos de datos

Los modelos se definen en Supabase (Postgres) y se validan en tiempo de ejecucion con Zod (`src/lib/models/definitions.ts`). Este documento es la fuente de verdad para campos y restricciones.

## Tabla `profiles`
> Definida en `docs/database/database.sql` (SECTION: Core schema and RLS) y sincronizada con `auth.users`.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | UUID | Clave primaria; coincide con `auth.users.id` |
| `name` | text | Requerido |
| `email` | text | Requerido, debe coincidir con Supabase Auth |
| `role` | text | `member` o `admin`, default `member` |
| `status` | text | `active`, `inactive` o `suspended`, default `active` |
| `referral_code` | text | Unico; se genera al registrar usuario |
| `referred_by` | UUID | Referencia a otro perfil |
| `phone` | text | Opcional |
| `address` | text | Opcional |
| `city` | text | Opcional |
| `state` | text | Opcional |
| `postal_code` | text | Opcional |
| `country` | text | Opcional |
| `default_payment_provider` | text | `paypal`, `stripe` o `wallet`; controla la opción preseleccionada en checkout |
| `commission_rate` | numeric(5,2) | Porcentaje 0.00-1.00 (10% por defecto) |
| `total_earnings` | numeric(10,2) | Acumula comisiones |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Actualizado via trigger `handle_updated_at()` |

### Esquemas Zod relacionados
```ts
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['member', 'admin']).default('member'),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  referral_code: z.string().optional(),
  referred_by: z.string().uuid().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  commission_rate: z.number().min(0).max(1).default(0.1),
  total_earnings: z.number().min(0).default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```
- `CreateUserProfileSchema`: elimina `id`, `created_at`, `updated_at`.
- `UpdateUserProfileSchema`: version parcial (`partial()`) para updates.

## Tabla `products`
> Definida en `docs/database/database.sql` (SECTION: Core schema and RLS) y ampliada por la sección `Product inventory metrics` del mismo archivo.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | UUID | Generado por `gen_random_uuid()` |
| `slug` | text | Unico; usado en rutas `/[lang]/products/[slug]` |
| `name` | text | Requerido |
| `description` | text | Requerido |
| `price` | numeric(10,2) | Precio unitario |
| `stock_quantity` | integer | Unidades disponibles para venta |
| `images` | jsonb | Lista de imagenes serializadas |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()` |

### Esquemas Zod
```ts
export const ProductImageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  hint: z.string(),
});

export const ProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  stock_quantity: z.number().int().min(0),
  images: z.array(ProductImageSchema),
});
```
- El servicio de productos (`product-service.ts`) convierte el JSONB de supabase en objetos `ProductImage`.
- `uploadProductImages` sube archivos al bucket `products` y construye la estructura `{id, url, hint}`.
- La columna `stock_quantity` se alimenta desde el admin y alimenta las métricas del dashboard (`AdminDashboardViewModel`).

## Modelos complementarios
- `Locale`: union `'en' | 'es'` usada en App Router.
- `ProductImage`: se usa tanto en landing (`ProductCard`) como en admin.
- `UserProfile` se emplea en componentes admin (`src/app/admin/users/page.tsx`) y en vistas de equipo (`src/app/[lang]/team/page.tsx`).

## Tabla `team_messages`
> Definida en `docs/database/full-schema.sql` (SECTION: Team messaging).

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | UUID | Generado por `gen_random_uuid()` |
| `sender_id` | UUID | Referencia a `profiles.id`; mensaje saliente |
| `recipient_id` | UUID | Referencia a `profiles.id`; destinatario directo |
| `body` | text | Mensaje en texto plano; validado entre 1 y 2000 caracteres |
| `parent_message_id` | UUID | Referencia opcional al mensaje raíz de la conversación |
| `created_at` | timestamptz | Default `timezone('utc', now())` |
| `read_at` | timestamptz | Se asigna al marcar el mensaje como leído |

- RLS: solo el emisor o receptor pueden leer registros; únicamente el receptor puede actualizar `read_at`.
- Las réplicas se asocian al hilo estableciendo `parent_message_id` al identificador del mensaje raíz.

## Notas de consistencia
- `commission_rate` en UI se muestra como porcentaje; al guardar se divide entre 100 antes de persistir (`src/app/admin/users/edit/[id]/page.tsx`).
- `total_earnings` se almacena como numero decimal, no se calcula automaticamente.
- `state` y `postal_code` permiten precargar la dirección de envío en checkout.
- `default_payment_provider` guarda la pasarela preferida del usuario para sugerirla en el pago (`paypal`, `stripe` o el saldo `wallet`).
- Las validaciones del lado del servidor usan los mismos esquemas para mantener paridad con el cliente.

## Referencias
- `src/lib/models/definitions.ts`
- `src/lib/services/product-service.ts`
- `src/lib/services/user-service.ts`
- `docs/database/full-schema.sql`

## Tabla `payment_gateways`
> Configuración centralizada de proveedores de pago.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | UUID | Clave primaria generada automáticamente |
| `provider` | text | `paypal`, `stripe` o `wallet`; único |
| `is_active` | boolean | Indica si el gateway está disponible para los usuarios |
| `credentials` | jsonb | Credenciales almacenadas (ver estructura abajo) |
| `created_at` | timestamptz | Marca de creación |
| `updated_at` | timestamptz | Actualización automática vía trigger |

### Estructura del campo `credentials` (JSONB)

**Para Stripe:**
```json
{
  "publishableKey": "pk_live_xxx",
  "secret": "sk_live_xxx",
  "webhookSecret": "whsec_xxx",
  "connectClientId": "ca_xxx",
  "testPublishableKey": "pk_test_xxx",
  "testSecret": "sk_test_xxx",
  "testWebhookSecret": "whsec_test_xxx",
  "testConnectClientId": "ca_test_xxx",
  "mode": "production"
}
```

**Para PayPal:**
```json
{
  "clientId": "xxx",
  "secret": "xxx",
  "webhookSecret": "xxx",
  "testClientId": "xxx",
  "testSecret": "xxx",
  "testWebhookSecret": "xxx",
  "mode": "production"
}
```

**Notas importantes:**
- `connectClientId` y `testConnectClientId` son necesarios para Stripe Connect (permitir que usuarios conecten sus cuentas)
- `mode` puede ser `"production"` o `"test"` y determina qué credenciales se usan
- Seed inicial: el script crea filas inactivas para PayPal y Stripe y deja la wallet habilitada por defecto

### Esquemas Zod relacionados
Los esquemas viven en `src/modules/payments/domain/models/payment-gateway.ts`:

```ts
export const PaymentGatewaySettingsSchema = z.object({
  provider: z.enum(['paypal', 'stripe', 'wallet']),
  status: z.enum(['active', 'inactive']),
  clientId: z.string().nullable().optional(),
  publishableKey: z.string().nullable().optional(),
  hasSecret: z.boolean(),
  hasWebhookSecret: z.boolean(),
  updatedAt: z.string().datetime().nullable().optional(),
});
```

Otros esquemas relevantes: `PaymentGatewayUpdateInputSchema` y `PaymentGatewayPublicInfoSchema` para validar las peticiones REST y las respuestas públicas.

## Tabla `site_branding_settings`
> Configura la identidad global del sitio.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | text | Clave primaria. Usamos el valor fijo `global`. |
| `app_name` | text | Nombre comercial que se muestra en toda la experiencia. |
| `logo_url` | text | URL opcional de la imagen del logo. |
| `favicon_url` | text | URL opcional del favicon que se muestra en navegadores y metadatos. |
| `description` | text | Descripción corta opcional utilizada en metadatos y pie de página. |
| `show_logo` | boolean | Controla si se muestra el logo en el encabezado. |
| `logo_position` | text | Posición del logo respecto al nombre de la app (`beside`, `above`, `below`). |
| `show_app_name` | boolean | Controla si se muestra el nombre de la app en el encabezado. |
| `updated_at` | timestamptz | Marca de tiempo del último cambio. |

### Esquemas Zod relacionados
- `SiteBrandingSchema` y `SiteBrandingUpdateSchema` viven en `src/modules/site-content/domain/models/site-branding.ts`.
- `createDefaultBranding` genera un branding base usando el nombre por defecto de la app.

## Tabla `app_settings`
> Configuración centralizada de la compensación multinivel.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | text | Clave primaria con valor fijo `global`. |
| `base_commission_rate` | numeric(5,4) | Porcentaje decimal (0-1) para comisiones directas. |
| `referral_bonus_rate` | numeric(5,4) | Porcentaje decimal aplicado a overrides de red. |
| `leadership_pool_rate` | numeric(5,4) | Porcentaje destinado al fondo de liderazgo. |
| `max_members_per_level` | jsonb | Lista de objetos `{level, max_members}` para topes por nivel. |
| `payout_frequency` | text | Valores permitidos: `weekly`, `biweekly`, `monthly`. |
| `currency` | text | Código ISO 4217 en mayúsculas. |
| `auto_advance_enabled` | boolean | Activa el ascenso automático cuando se cumplen los cupos. |
| `created_at` | timestamptz | Marca de creación. |
| `updated_at` | timestamptz | Actualizado mediante el trigger `handle_updated_at()`. |

### Esquemas Zod relacionados
- `AppSettingsSchema` y `AppSettingsUpdateSchema` viven en `src/modules/app-settings/domain/models/app-settings.ts`.
- `DEFAULT_APP_SETTINGS` documenta el estado inicial que insertamos vía `full-schema.sql`.


## Tabla `landing_page_content`
> Contenido editable de la landing page por idioma.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `locale` | text | Clave primaria. Debe coincidir con los valores definidos en `i18n.locales`. |
| `hero` | jsonb | Título, subtítulo e imagen de fondo de la sección hero. |
| `about` | jsonb | Contenido de la sección "Sobre nosotros". |
| `how_it_works` | jsonb | Encabezados y pasos ordenados para explicar el flujo de negocio. |
| `opportunity` | jsonb | Configuración de la sección "Business Opportunity Roadmap" y sus fases. |
| `testimonials` | jsonb | Contenido de la sección "What Our Members Say". |
| `featured_products` | jsonb | Textos y estados vacíos para "Featured Products". |
| `contact` | jsonb | Textos, placeholders y correo receptor de la sección "Contact Us". |
| `header` | jsonb | Botones, enlaces y toggles del encabezado. |
| `footer` | jsonb | Enlaces, redes sociales y toggles del pie de página. |
| `faqs` | jsonb | Lista ordenada de preguntas frecuentes. |
| `updated_at` | timestamptz | Última actualización del contenido. |

### Campos específicos de `contact`
- `title`, `description`: Encabezados principales de la sección.
- `contactInfo.phone`, `contactInfo.email`, `contactInfo.address`: Datos visibles para que la audiencia se comunique.
- `form.namePlaceholder`, `form.emailPlaceholder`, `form.messagePlaceholder`, `form.sendButton`: Textos del formulario público.
- `recipientEmail`: Correo privado que recibirá los mensajes enviados desde el formulario de contacto.

### Campos específicos de `footer`
- `brandingAppName`: Nombre que se mostrará en el bloque de marca del footer. Si está vacío, se usa el nombre global de la aplicación.
- `showBrandingLogo`, `showBrandingAppName`, `showBrandingDescription`: Toggles para controlar la visibilidad del logo, nombre y eslogan.
- `brandingOrientation`: Controla si el logo aparece al lado, arriba o abajo del nombre configurado.

### Esquemas Zod relacionados
- `LandingContentSchema` y sub-esquemas (`LandingHeroContentSchema`, `LandingHowItWorksSchema`, etc.) en `src/modules/site-content/domain/models/landing-content.ts`.
- `LandingContentUpdateSchema` y los servicios asociados (`getLandingContent`, `updateLandingContent`) se encuentran en `src/modules/site-content/services/site-content-service.ts`.
- `SupabaseSiteContentRepository` convierte los registros JSONB a modelos tipados (`src/modules/site-content/data/repositories/supabase-site-content-repository.ts`).

## Tabla `contact_settings`
> Configura los correos de origen y destino usados por el formulario público.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | text | Clave primaria. Se usa el valor fijo `global`. |
| `from_name` | text | Nombre mostrado como remitente en los correos salientes. |
| `from_email` | text | Correo electrónico desde el cual se envían los mensajes. |
| `reply_to_email` | text | Correo opcional al que se dirigirán las respuestas (si se omite, se usa el correo del visitante). |
| `recipient_email_override` | text | Destinatario alternativo que recibe todos los envíos, independiente de `landing_page_content.contact.recipientEmail`. |
| `cc_emails` | text[] | Lista de correos en copia. |
| `bcc_emails` | text[] | Lista de correos en copia oculta. |
| `subject_prefix` | text | Prefijo opcional que se antepone al asunto de cada correo. |
| `auto_response_enabled` | boolean | Indica si se envía una confirmación automática al visitante. |
| `auto_response_subject` | text | Asunto de la confirmación automática (cuando está habilitada). |
| `auto_response_body` | text | Cuerpo del mensaje automático. Permite tokens `{{name}}` y `{{email}}`. |
| `created_at` | timestamptz | Fecha de creación. |
| `updated_at` | timestamptz | Última actualización. |

### Esquemas Zod relacionados
- `ContactSettingsSchema` y `ContactSettingsUpdateSchema` viven en `src/modules/contact/domain/models/contact-settings.ts`.
- El servicio `getContactSettings` aplica overrides desde variables de entorno antes de exponer el modelo (`src/modules/contact/services/contact-service.ts`).

## Tabla `contact_messages`
> Registro histórico de cada envío del formulario de contacto.

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | uuid | Clave primaria generada automáticamente. |
| `created_at` | timestamptz | Momento en el que se intentó enviar el correo. |
| `locale` | text | Idioma desde el cual se envió el formulario. |
| `name` | text | Nombre capturado en el formulario. |
| `email` | text | Correo del visitante. |
| `message` | text | Mensaje enviado. |
| `recipient_email` | text | Destinatario final utilizado para ese envío. |
| `subject` | text | Asunto generado para el correo. |
| `status` | text | `sent` o `failed` según el resultado del intento. |
| `error_message` | text | Detalle opcional cuando `status = 'failed'`. |

### Esquemas y servicios
- Las inserciones se realizan desde `submitContactMessage` en `src/modules/contact/services/contact-service.ts`.
- No existe Zod público porque la tabla solo recibe datos controlados por el servidor.
