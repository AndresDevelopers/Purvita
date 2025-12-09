# Mailchimp System Guide / Guía del Sistema Mailchimp

> **Why this document exists / Por qué existe este documento**
> 
> - **English:** Centralizes every Mailchimp workflow (maintenance waitlist, user registration opt-in, environment setup and troubleshooting) in a single reference so administrators and developers can onboard in minutes.
> - **Español:** Centraliza todos los flujos de Mailchimp (lista de espera en mantenimiento, opt-in durante el registro, configuración de variables y resolución de problemas) en una sola referencia para que administradores y desarrolladores se integren en minutos.

---

## 1. System Overview / Panorama del Sistema

| Component / Componente | Responsibility / Responsabilidad | Key Files / Archivos Clave |
|------------------------|----------------------------------|----------------------------|
| Admin `Site Status` block | Toggle waitlist, capture `audienceId` + `serverPrefix`. | `src/app/admin/site-status/page.tsx` |
| Supabase `site_mode_settings` | Persists Mailchimp settings for each site mode. | `docs/database/full-schema.sql` (`mailchimp_enabled`, `mailchimp_audience_id`, `mailchimp_server_prefix`) |
| Registration web flow | Subscribes new users on account creation. | `src/app/[lang]/auth/register/page.tsx` |
| API `mailchimp-subscribe` route | Normalizes payloads, calls Mailchimp API with API key. | `src/app/api/auth/mailchimp-subscribe/route.ts` |
| Notification Preferences | Stores user preferences and syncs with Mailchimp. | `src/modules/notifications/services/notification-preferences-service.ts` |
| Settings UI | Allows users to control Mailchimp subscription. | `src/app/[lang]/settings/notifications/page.tsx` |
| Mailchimp audience | Destination list that receives both waitlist and registration contacts. | Mailchimp UI |

### Supported Journeys / Flujos Soportados
- **Maintenance Waitlist / Lista de espera en mantenimiento:** Visitors submit email while the storefront is offline; lead is pushed to the configured audience.
- **User Registration Auto-subscribe / Suscripción automática en registro:** Every successful signup triggers an opt-in with tags and merge fields (`FNAME`, `LNAME`).
- **User-controlled Subscription / Suscripción controlada por el usuario:** Users can manage their Mailchimp subscription via Settings → Notification Preferences → Promotional Offers. Changes are automatically synchronized with Mailchimp.

---

## 2. Configuration Checklist / Lista de Configuración

### 2.1 Environment Variables / Variables de Entorno

| Name / Nombre | Example / Ejemplo | Where to set / Dónde configurarla |
|---------------|-------------------|-----------------------------------|
| `MAILCHIMP_API_KEY` | `abcd1234-us21` | `.env.local`, hosting provider |
| `MAILCHIMP_AUDIENCE_ID` | `a1b2c3d4e5` | `.env.local`, hosting provider |

- **Validation / Validación:** Both variables are validated by `src/lib/env.ts`. Update `.env.example` whenever values change in production.
- **Security / Seguridad:** Never commit real keys. Grant the API key audience-only permissions following the principle of least privilege.

### 2.2 Admin Quick Start / Inicio rápido en el panel

1. Navigate to **`/admin/site-status`**.
2. Enable **Mailchimp integration**.
3. Paste:
   - **Audience ID:** Mailchimp → Audience → Settings → *Audience name and defaults*.
   - **Server Prefix:** Portion before `.admin.mailchimp.com` in the URL (e.g. `us21`).
4. Save and test by submitting the waitlist form.

### 2.3 Registration Flow Setup / Configuración del flujo de registro

1. Ensure both environment variables are present before deploying the auth service.
2. Confirm the API route `mailchimp-subscribe` is included in the deployment bundle (Next.js App Router loads automatically).
3. Tag configuration inside the service:
   - Tag `registration` is applied to every new contact.
   - Status `subscribed` keeps the contact active.
4. Optional: Create additional segments in Mailchimp filtered by the `registration` tag for analytics.

---

## 3. Data Flow Details / Detalle de Flujos de Datos

### 3.1 Maintenance Mode Waitlist / Lista de espera en modo mantenimiento

**English**
1. Visitor opens the storefront while Maintenance or Coming Soon mode is active.
2. The waitlist form posts to the API with `email` and locale.
3. `site_mode_settings` provides `mailchimp_audience_id` and `mailchimp_server_prefix`.
4. The API composes the Mailchimp endpoint `https://<prefix>.api.mailchimp.com/3.0/lists/<audienceId>/members`.
5. Contact is upserted with status `subscribed`.

**Español**
1. El visitante abre la tienda mientras está en modo Maintenance o Coming Soon.
2. El formulario de lista de espera envía `email` y el locale al API.
3. `site_mode_settings` entrega `mailchimp_audience_id` y `mailchimp_server_prefix`.
4. El API construye el endpoint `https://<prefix>.api.mailchimp.com/3.0/lists/<audienceId>/members`.
5. Se hace *upsert* del contacto con estado `subscribed`.

### 3.2 Registration Auto-subscribe / Suscripción automática en registro

| Field | Mailchimp Merge Field | Notes |
|-------|-----------------------|-------|
| `user.email` | `EMAIL` | Primary identifier (lowercase MD5 hash used by API). |
| `user.profile.firstName` | `FNAME` | Defaults to empty string if missing. |
| `user.profile.lastName` | `LNAME` | Defaults to empty string if missing. |
| Static tag | `registration` | Enables segmentation of signup leads. |

- **English:** If Mailchimp returns "Member Exists", the workflow treats it as success and continues signup.
- **Español:** Si Mailchimp responde "Member Exists", el flujo lo considera exitoso y el registro continúa.

#### User Control via Notification Preferences / Control del Usuario mediante Preferencias de Notificación

**English:**
- When a user registers, they are automatically subscribed to Mailchimp with the `registration` tag
- A database trigger automatically creates notification preferences with `promotional_offers = true` to reflect this subscription
- Users can manage their Mailchimp subscription via Settings → Notification Preferences → Promotional Offers
- When a user disables "Promotional Offers", they are automatically unsubscribed from Mailchimp
- When a user re-enables "Promotional Offers", they are automatically re-subscribed to Mailchimp with the tag `promotional-offers`

**Español:**
- Cuando un usuario se registra, se suscribe automáticamente a Mailchimp con la etiqueta `registration`
- Un trigger de base de datos crea automáticamente las preferencias de notificación con `promotional_offers = true` para reflejar esta suscripción
- Los usuarios pueden gestionar su suscripción a Mailchimp desde Ajustes → Preferencias de Notificación → Ofertas Promocionales
- Cuando un usuario desactiva "Ofertas Promocionales", se desuscribe automáticamente de Mailchimp
- Cuando un usuario reactiva "Ofertas Promocionales", se vuelve a suscribir automáticamente a Mailchimp con la etiqueta `promotional-offers`

**Technical Files / Archivos Técnicos:**
- Database trigger: `docs/database/migrations/create-notification-preferences-trigger.sql`
- Service handling sync: `src/modules/notifications/services/notification-preferences-service.ts`
- Settings UI (Main): `src/app/[lang]/settings/notifications/page.tsx`
- Settings UI (Affiliate): `src/app/[lang]/affiliate/[referralCode]/settings/notifications/page.tsx`

### 3.3 Error Handling / Manejo de errores

- Failures in Mailchimp **never block** account creation; errors are logged server-side for later review.
- API responses include clear status codes for monitoring integrations (`4xx` client misconfiguration, `5xx` upstream failures).

---

## 4. Operations & Testing / Operaciones y Pruebas

### 4.1 Smoke Test Script / Script de verificación rápida

```bash
# Development
MAILCHIMP_API_KEY="sk_test-us21" MAILCHIMP_AUDIENCE_ID="a1b2c3d4e5" npm run dev
```

1. Register a throwaway user → confirm appearance in Mailchimp (tag `registration`).
2. Toggle Maintenance mode → submit waitlist form → confirm contact with tag `waitlist` (set via frontend form metadata).
3. Inspect Supabase table `site_mode_settings` to ensure settings persist per environment.

### 4.2 Operational Checklist / Lista Operativa

- [ ] Document the audience ID and server prefix per environment in release notes.
- [ ] Rotate the API key yearly or whenever team members change.
- [ ] Verify rate limits before high-traffic campaigns.

---

## 5. Troubleshooting / Resolución de Problemas

| Symptom / Síntoma | Diagnostic Steps / Pasos de diagnóstico |
|-------------------|------------------------------------------|
| "Waitlist unavailable" banner | Check admin toggle, confirm both fields are stored in `site_mode_settings`. |
| `The requested resource could not be found` | Audience ID typo or deleted list — re-copy from Mailchimp settings. |
| `Invalid API key format` | The key must end with `-usXX`; recreate the key if the suffix is missing. |
| Contacts missing merge fields | Ensure registration form collects first/last name or default them server-side. |
| Different environments share contacts | Use dedicated audiences per environment to avoid mixing.

---

## 6. Security & Compliance / Seguridad y Cumplimiento

- **Least Privilege / Menor privilegio:** Restrict the Mailchimp API key to the required audience scopes only.
- **Secrets Handling / Manejo de secretos:** Store API keys in environment variables (`.env.local`, hosting dashboard). Never commit them.
- **Auditability / Auditoría:** Enable Mailchimp activity feed to trace subscription origins and correlate with PurVita logs.
- **GDPR/CCPA:** Ensure waitlist and registration forms provide the required consent copy for your region.

---

## 7. Related References / Referencias Relacionadas

### Core Services / Servicios Principales
- `src/lib/services/mailchimp-service.ts` – Core helper for Mailchimp API requests.
- `src/modules/notifications/services/notification-preferences-service.ts` – Synchronizes user preferences with Mailchimp.

### API Endpoints / Endpoints del API
- `src/app/api/auth/mailchimp-subscribe/route.ts` – API endpoint for both waitlist and registration flows.
- `src/app/api/notifications/preferences/route.ts` – API endpoint for managing user notification preferences.

### User Interface / Interfaz de Usuario
- `src/app/[lang]/auth/register/page.tsx` – Registration form hooking into the API route.
- `src/app/[lang]/settings/notifications/page.tsx` – Settings page for managing notification preferences (Main website).
- `src/app/[lang]/affiliate/[referralCode]/settings/notifications/page.tsx` – Settings page for affiliates.

### Database / Base de Datos
- `docs/database/migrations/create-notification-preferences-table.sql` – Creates the notification_preferences table.
- `docs/database/migrations/create-notification-preferences-trigger.sql` – Auto-creates preferences on user registration.
- `docs/database/full-schema.sql` – Source of truth for `site_mode_settings` and `notification_preferences` tables.

### Configuration / Configuración
- `docs/environment-variables.md` – Global environment reference (Mailchimp section).

---

**Last review / Última revisión:** 2025-10-23
**Maintainer / Responsable:** Platform Team
