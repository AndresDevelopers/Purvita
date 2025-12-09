# Configuracion del envio de correos de contacto

Esta guia resume todo lo necesario para que el formulario publico de contacto
pueda enviar correos correctamente usando Resend y Supabase. Sigue los pasos en
orden para evitar errores de configuracion.

## 1. Variables de entorno requeridas

| Variable | Obligatoria | Descripcion |
| --- | --- | --- |
| `RESEND_API_KEY` | Si | Token del API de Resend con permiso de "sending". |
| `CONTACT_FROM_EMAIL` | Si | Correo verificado por Resend que aparecera como remitente. |
| `CONTACT_FROM_NAME` | Si | Nombre amigable que acompana al remitente. |
| `CONTACT_REPLY_TO_EMAIL` | Opcional | Si se define, las respuestas iran a esta direccion; de lo contrario se usa el correo del visitante. |
| `CONTACT_SUBJECT_PREFIX` | Opcional | Prefijo que se anade al asunto (p. ej. `[PurVita Contact]`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Si | Habilita las APIs admin para guardar ajustes y registrar el log. |

1. Copia `.env.example` a `.env.local` y completa los valores anteriores.
2. Si deployas en Vercel u otra plataforma, replica las mismas variables en el
   entorno remoto.
3. Reinicia `npm run dev` tras modificar el archivo `.env.local`.

> 💡 La pagina de administracion mostrara alertas cuando falte alguna variable,
> pero el correo **no se enviara** hasta que `RESEND_API_KEY` y el remitente
> esten configurados.

## 2. Preparar tablas en Supabase

Ejecuta el editor SQL de Supabase **despues** de cargar el esquema base y aplica:

1. `docs/database/database.sql` (SECTION: Contact recipient defaults) – agrega `contact.recipientEmail` al
   contenido de la landing y rellena un valor inicial.
2. `docs/database/database.sql` (SECTION: Contact settings tables) – crea `contact_settings` (ajustes editables) y
   `contact_messages` (registro de envios).
3. Corre `docs/database/verification-suite.sql` para verificar que las tablas aparezcan sin errores:
   ```sql
   \i docs/database/verification-suite.sql
   ```

Si `contact_settings` no existe o el registro `global` falta, la API devolvera
500 y el formulario mostrara un error al visitante.

## 3. Configuracion desde el panel admin

1. Entra a **Site Content → Contact** y actualiza `Correo destinatario` con la
   casilla que debe recibir los mensajes por defecto.
2. Abre **Contact Settings** en el menu lateral para ajustar:
   - Remitente (`From name` y `From email`).
   - Respuestas (`Reply-to email`).
   - Destinatario alterno (`Recipient override`), CC/BCC y prefijo del asunto.
   - Auto respuesta (asunto y cuerpo soportan `{{name}}`/`{{email}}`).
3. La tarjeta *Email provider status* confirma si las variables de entorno
   estan listas.
4. Guarda los cambios; la API `PUT /api/admin/contact-settings` requiere la
   `SUPABASE_SERVICE_ROLE_KEY` configurada en el servidor.

## 4. Pruebas rapidas

1. Desde la landing publica envia un mensaje de prueba.
2. Verifica en Resend que el correo se haya entregado.
3. Ejecuta en Supabase:
   ```sql
   select id, created_at, status, error_message
   from contact_messages
   order by created_at desc
   limit 10;
   ```
   Deberias ver el registro con `status = 'sent'`. Si aparece `failed`, revisa la
   columna `error_message`.

## 5. Problemas frecuentes

| Sintoma | Causa | Solucion |
| --- | --- | --- |
| `Email provider is not configured. Missing RESEND_API_KEY.` | Falta la variable en el entorno. | Define `RESEND_API_KEY` y reinicia el servidor. |
| El admin muestra "Service role credentials not configured" al guardar. | Falta `SUPABASE_SERVICE_ROLE_KEY` en el backend. | Agrega la clave de servicio y reinicia. |
| El formulario indica que el destinatario no esta configurado. | `landing_page_content.contact.recipientEmail` esta vacio y no hay override. | Completa el campo desde **Site Content → Contact** o el override en **Contact Settings**. |
| Resend rechaza el remitente. | El dominio/correo no esta verificado en Resend. | Verifica el dominio o usa un remitente aprobado. |

## Referencias rapidas

- `.env.example`
- `docs/database/full-schema.sql`
- `docs/database/verification-suite.sql`
- `src/app/api/contact/route.ts`
- `src/app/admin/contact-settings/page.tsx`
- `src/modules/contact/services/contact-service.ts`
