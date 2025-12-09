# Red PūrVita

Bienvenido a **PūrVita**, una aplicación web moderna construida con Next.js, React y TypeScript. Este proyecto sirve como base para una plataforma de marketing multinivel con venta de productos, internacionalización y una arquitectura sólida preparada para escalar.

## Puesta en marcha

### Requisitos previos

- **Node.js 22.x** y **npm 10** (instala la versión especificada en `.nvmrc` para evitar inconsistencias).
- **Cuenta de Supabase** con acceso a un proyecto donde ejecutar los esquemas SQL incluidos en `docs/database/`.
- **Claves de Resend** si deseas probar el envío de correos electrónicos desde el formulario público.

Para iniciar el entorno de desarrollo:

1. **Instala las dependencias**

   ```bash
   npm install
   ```

2. **Levanta el servidor de desarrollo**

   ```bash
   npm run dev
   ```

Abre [http://localhost:9001](http://localhost:9001) en el navegador para ver la aplicación en ejecución.

### Variables de entorno requeridas

Todas las configuraciones sensibles viven en `.env.local`. Parte desde `.env.example` y completa cada variable antes de levantar el servidor:

| Categoría | Variables | Propósito |
| --- | --- | --- |
| Identidad de la app | `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_ENV` | Define el nombre comercial, la URL base (puerto 9001 en desarrollo) y el entorno activo. |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Conexión al proyecto de Supabase. |
| Seguridad API | `API_RATE_LIMIT_REQUESTS`, `API_RATE_LIMIT_WINDOW_MS` | Controla el rate limiting por IP para las rutas sensibles. |
| Observabilidad | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | Activa trazas, replays y monitoreo en Sentry (ajusta los porcentajes entre 0 y 1). |
| Email transaccional | `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_FROM_NAME`, `CONTACT_REPLY_TO_EMAIL`, `CONTACT_SUBJECT_PREFIX` | Configura las credenciales y los remitentes del formulario público. |
| Marketing | `MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID` | Sincroniza los leads captados con la lista de Mailchimp. |
| Pagos | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` | Permite probar los flujos de compra con Stripe (usa llaves de prueba en desarrollo). |

> ℹ️ **Consejo**: mantén actualizado `.env.example` cuando se agreguen integraciones nuevas para que otros colaboradores sepan qué valores deben configurar.
>
> 🛠️ **Carga de variables por entorno**: Next.js maneja automáticamente la carga de variables de entorno según el entorno:
>
> - **Desarrollo** (`npm run dev`): Lee `.env.local` (recomendado para desarrollo local), `.env.development.local`, `.env.development`, y `.env` en ese orden de prioridad.
> - **Producción** (`npm run build` y `npm start`): Lee `.env.production.local`, `.env.local`, `.env.production`, y `.env` en ese orden de prioridad.
>
> Para desarrollo local, usa `.env.local` para evitar usar credenciales de producción por accidente. Para despliegues en producción, configura las variables directamente en tu plataforma de hosting (Vercel, Railway, etc.) o usa un archivo `.env` en el servidor.

### Configuración del formulario de contacto

El formulario público utiliza Resend y tablas en Supabase. Configúralo antes de probar envíos:

1. Copia `.env.example` a `.env.local` y completa las variables del bloque **Email transaccional**.
2. En Supabase ejecuta `docs/database/full-schema.sql` (secciones *Contact recipient defaults* y *Contact settings tables*) y valida con `docs/database/verification-suite.sql`.
3. Desde el panel de administración ajusta los destinatarios en **Site Content → Contact** y configura el enrutamiento/autorespuesta en **Contact Settings**.

Consulta [docs/contact-email-setup.md](docs/contact-email-setup.md) para una guía detallada (en español) con consejos de resolución de problemas.

## Arquitectura

El proyecto sigue un patrón **Model-View-Controller-Service (MVCS)** adaptado a Next.js:

- **Modelo**: Los esquemas de datos se definen y validan con **Zod** en `src/lib/models/`, garantizando integridad y contratos compartidos.
- **Vista**: Componentes React estilizados con **ShadCN UI** y **Tailwind CSS**, con soporte para temas (claro/oscuro) e internacionalización.
- **Controlador**: La lógica de negocio y las mutaciones se gestionan mediante rutas API de Next.js (por ejemplo, `src/app/api/health/route.ts`).
- **Servicio**: La lógica reutilizable (integraciones externas, fetching, auditoría) vive en `src/lib/services/` con inyección de dependencias.

### Convenciones de Next.js 15 (App Router)

- **Parámetros asíncronos**: Las páginas y layouts reciben `params` como `Promise`, por lo que deben usarse con `await` para aprovechar el streaming.
- **Ruteo internacionalizado**: El segmento dinámico `[lang]` ofrece soporte multilenguaje (es/en) con manejo correcto de parámetros y metadatos.
- **Componentes de servidor**: Renderizado por defecto en el servidor con hidratación selectiva para componentes interactivos.

### Patrones y buenas prácticas

- **Repository Pattern**: Cada módulo (productos, usuarios, clases, seguridad) expone una interfaz de repositorio e implementación concreta en Supabase, facilitando pruebas y sustitución de fuentes de datos.
- **Factory Pattern**: Las factorías instancian servicios y repositorios con dependencias inyectadas, evitando acoplamiento rígido.
- **Observer Pattern**: Se emplean buses de eventos y contextos React para propagar cambios de estado (productos, panel administrativo) sin acoplar consumidores.
- **Error Boundary Pattern**: `error.tsx` y `GlobalErrorBoundary` aíslan fallos, muestran mensajes amigables e incluyen acciones de reintento.
- **Validación de esquemas**: Los modelos usan Zod tanto en el servidor como en el cliente para validación en tiempo de ejecución y tipos de TypeScript.
- **Auditoría**: `src/lib/services/audit-log-service.ts` registra acciones críticas para trazabilidad y cumplimiento.
- **Health checks**: `/api/health` permite monitoreo y verificaciones de disponibilidad.

### Resiliencia y confiabilidad

- **Circuit Breaker**: Los servicios externos deben envolver sus llamadas con cortacircuitos para evitar fallos en cascada.
- **Reintentos**: Implementar reintentos con backoff exponencial frente a errores transitorios de red.
- **Timeouts**: Toda llamada externa debe tener tiempos de espera controlados.
- **Degradación progresiva**: Las funcionalidades no críticas deben ocultarse temporalmente cuando haya fallos sin afectar el flujo principal.

### Observabilidad y monitoreo

- **Analíticas de Vercel**: Activadas desde el layout raíz; en desarrollo registran en consola y en producción envían eventos.
- **Integración con Sentry**: El cliente, servidor y edge inicializan Sentry con las variables definidas en `.env.example` (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, etc.).
- **Control de muestreo**: Ajusta `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE` y `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` (rangos entre `0` y `1`).
- **Privacidad**: Sentry solo se activa cuando se proporcionan DSN, evitando filtraciones en entornos locales.

## Flujo de calidad y pruebas

Antes de abrir un Pull Request ejecuta:

| Objetivo | Comando | Notas |
| --- | --- | --- |
| Análisis estático | `npm run lint` | Aplica reglas de ESLint, accesibilidad y seguridad. |
| Seguridad de tipos | `npm run typecheck` | Ejecuta `tsc --noEmit` para mantener contratos confiables. |
| Pruebas unitarias y cobertura | `npm run test` | Ejecuta Vitest con reportes de cobertura; añade pruebas para cada corrección. |
| Build de producción | `npm run build` | Asegura que Next.js 15.5.6 compila sin advertencias. |

Para validar la experiencia mobile-first revisa manualmente los breakpoints 320 px, 768 px, 1024 px y 1440 px. Documenta cualquier hallazgo o tarea de seguimiento.

### Dominio usado en GitHub Actions

El pipeline de CI/CD fija `APP_BASE_URL` a `https://purvitahealth.com` para reflejar el dominio productivo. Si en el futuro necesitas apuntar a otra URL (por ejemplo, un entorno provisional), define la variable de repositorio `PRODUCTION_BASE_URL` en GitHub; de lo contrario, la acción seguirá utilizando el dominio principal sin depender de dominios de prueba.

## Reporte de bugs, ideas y soporte comunitario

Ponemos especial cuidado en que la comunicación con el equipo de PūrVita sea directa y transparente. Para solicitar ayuda, reportar errores o proponer nuevas funcionalidades sigue estas pautas:

1. **Errores en producción o staging**
   - Abre un issue usando la plantilla **"Reporte de bug"** en [la pestaña de Issues](https://github.com/purvita-team/purvita/issues/new?template=bug_report.md).
   - Incluye capturas de pantalla, pasos para reproducir el problema, dispositivo/navegador y severidad percibida.
   - Si el bug afecta datos sensibles, envía también un correo a [support@purvitahealth.com](mailto:support@purvitahealth.com) para acelerar la atención.

2. **Sugerencias y nuevas funcionalidades**
   - Utiliza la plantilla **"Solicitud de funcionalidad"** en [Issues](https://github.com/purvita-team/purvita/issues/new?template=feature_request.md).
   - Explica el contexto de negocio, usuarios impactados y métricas esperadas.
   - Adjunta wireframes, enlaces o documentación adicional que ayude a la priorización.

3. **Preguntas o asistencia general**
   - Revisa primero la [documentación en `docs/`](docs/) y las secciones de este README.
   - Si la duda persiste, crea un issue con la etiqueta `question` o escribe al canal interno de soporte `#helpdesk` en Slack (solo colaboradores autorizados).

Todos los issues se triagean de lunes a viernes. El tiempo objetivo de primera respuesta es de **24 horas hábiles** y la actualización de estado mínima cada **72 horas**. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para conocer los criterios de aceptación y el flujo completo de Pull Requests.

## Tech Stack

- **Framework**: Next.js 15.5.6 (App Router)
- **UI**: React 19 con ShadCN UI y Tailwind CSS
- **Lenguaje**: TypeScript 5
- **Validación**: Zod
- **Internacionalización**: Configuración en `i18n/`
- **Autenticación**: Supabase
- **Generative AI**: No integrado actualmente (soporte Genkit removido)
- **PWA**: No habilitada

## Modelos de datos

Los esquemas Zod viven en `src/lib/models/definitions.ts` y se sincronizan con la base de datos Supabase.

### Perfiles de usuario

- `UserProfile`: Perfil completo asociado a autenticación.
- `CreateUserProfile`: Alta de usuarios.
- `UpdateUserProfile`: Actualizaciones parciales con validaciones.

### Productos

- `Product`: Catálogo con imágenes y precios.

## Integración con base de datos

- **Supabase** para autenticación y persistencia.
- **Perfiles** sincronizados con `auth.users`.
- **RLS** para acceso seguro.
- **Sistema de referidos** y **seguimiento de comisiones** integrado.

Lee [docs/database/README.md](docs/database/README.md) para instrucciones de despliegue de base de datos y migraciones.

### Documentación Técnica Completa

Para información detallada sobre los sistemas principales, consulta:

**Sistemas de Negocio:**

- **[Sistema de Comisiones MLM](docs/commission-system.md)** - Comisiones multinivel, ecommerce earnings, group gain y suscripciones
- **[Checkout y Pasarelas de Pago](docs/payment-system.md)** - Stripe/PayPal, retornos, pruebas administradas y seguridad
- **[Sistema de Pagos Automáticos](docs/payout-system.md)** - Stripe Connect, PayPal, transferencias a wallet y configuración
- **[Páginas de Afiliado](docs/affiliate-pages.md)** - Tiendas personalizadas, contexto de afiliado y configuración
- **[Sistema Automático de Fases](docs/AUTOMATIC_PHASE_SYSTEM.md)** - Promoción automática basada en crecimiento de red

**Administración:**

- **[Guía para Administradores](docs/admin-guide.md)** - Panel completo, impersonación, edición de fases y mensajería masiva
- **[Configuración de SEO](docs/SEO_SETUP.md)** - SEO centralizado multilingüe

**Seguridad:**

- **[Guía de Rotación de Secretos](docs/SECURITY_SECRET_ROTATION.md)** - Proceso de rotación de claves, schedule recomendado y mejores prácticas
- **[Auditoría de Seguridad del Admin](ADMIN_SECURITY_AUDIT.md)** - Reporte completo de auditoría del panel de administración

**Funcionalidades Específicas:**

- **[Historial de Órdenes y Facturas](docs/ORDER_HISTORY_INVOICES.md)** - Generación de facturas PDF
- **[Facturas de Suscripción](docs/SUBSCRIPTION_INVOICES.md)** - Gestión y archivado de facturas
- **[Archivado de Órdenes](docs/ARCHIVED_ORDERS_FEATURE.md)** - Organización del historial de compras
- **[Códigos de Registro](docs/REGISTRATION-CODES.md)** - Sistema de acceso controlado
- **[Valores del Dashboard](docs/DASHBOARD_VALUES.md)** - Origen de datos y cálculos

**Referencia Técnica:**

- **[Documentación de API](docs/api-reference.md)** - Endpoints y contratos
- **[Seguridad y Autenticación](docs/security.md)** - RLS, roles y permisos
- **[Arquitectura del Proyecto](docs/architecture.md)** - Patrones y estructura
- **[Modelos de Datos](docs/data-models.md)** - Esquemas y relaciones

📚 **Índice completo:** [docs/README.md](docs/README.md)

## Funcionalidades administrativas destacadas

### Panel administrativo

- Métricas en tiempo real (usuarios, productos, suscripciones, ingresos).
- Acciones rápidas y monitor de actividad reciente.

### Gestión de usuarios

- Listado con filtros y acciones masivas.
- Edición completa del perfil (datos personales, rol, estado, comisiones, contacto y localización).
- Vista detallada con historial y auditoría.

### Identidad y contenido de landing

- Actualiza nombre, logo y descripción desde `/admin/site-content`.
- Gestión localizada del hero, secciones informativas y FAQs.
- Cambios propagados automáticamente en encabezados, pies y metadatos.
- API REST segura en `/api/admin/site-content` con políticas `service-role`.

### Endpoints administrativos

- `GET /api/admin/users/[id]`: Obtiene perfiles con privilegios administrativos.
- `PUT /api/admin/users/[id]`: Actualiza perfiles con validación Zod.
- Autenticación con clave de servicio (`SUPABASE_SERVICE_ROLE_KEY`).
- Respuestas de error estandarizadas y auditoría de operaciones.

## Actualizaciones recientes

- **Mejoras en detalle de usuarios**: visualización de roles en minúsculas, fechas localizadas y layout consistente.
- **API de gestión de usuarios**: endpoints REST con autenticación de servicio y validaciones estrictas.
- **Módulo de contenido del sitio**: página administrativa, servicio reutilizable y API dedicada.
- **Modelo de seguridad reforzado**: servicios con cliente administrador y variables de entorno obligatorias.
- **Formulario de edición administrativa**: validación con Zod, manejo de comisiones, i18n y toasts accesibles.
- **Sistema de perfiles**: referidos, seguimiento de comisiones y control de roles.
- **Migración a Next.js 15.5.6**: parámetros asíncronos y convenciones documentadas en [docs/architecture/mvcs.md](docs/architecture/mvcs.md).
- **Clases en vídeo**: categorías, visibilidad (`all`, `subscription`, `product`), filtros automáticos y migración SQL en `docs/class-videos-migration.sql`.
- **Mensajería de equipo**: conversaciones uno a uno entre miembros del multinivel desde `/[lang]/teams` y bandeja de entrada con respuestas en `/[lang]/profile`; requiere ejecutar la migración `docs/migrations/20250113_create_team_messages.sql`.

## Dependencias operativas

- **Variables de entorno**: copia `.env.example` a `.env.local` y completa todas las variables obligatorias antes de iniciar el servidor. El archivo de ejemplo documenta los valores mínimos para desarrollo.
- **Migraciones de base de datos**: aplica el esquema completo con `docs/database/database.sql` y ejecuta las verificaciones en `docs/verified/verification-suite.sql` para garantizar que Supabase tenga tablas, políticas RLS y vistas esperadas.
- **Servicios externos**: configura las integraciones necesarias (Resend para email transaccional y las claves de Supabase) en el panel administrativo bajo **Site Content → Integrations** una vez que el backend esté conectado.

## Contribuciones

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para conocer el proceso de colaboración.

## Licencia

El proyecto está licenciado bajo MIT. Revisa el archivo [LICENSE](LICENSE) para más detalles.
