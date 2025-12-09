# Guía integral para administradores

> Esta guía documenta de forma completa cómo operar, configurar y mantener el panel administrativo de **PurVita**. Incluye la arquitectura del módulo, prerrequisitos de seguridad, descripción funcional de cada sección, fuentes de datos y buenas prácticas operativas.

## Tabla de contenido
1. [Acceso y prerrequisitos](#acceso-y-prerrequisitos)
2. [Arquitectura del panel](#arquitectura-del-panel)
3. [Navegación y páginas principales](#navegación-y-páginas-principales)
   - [Dashboard](#dashboard-admin-dashboard)
   - [Pedidos del día](#pedidos-del-día-admin-orders)
   - [Gestión de usuarios](#gestión-de-usuarios-admin-users)
   - [Gestión de productos](#gestión-de-productos-admin-products)
   - [Alta y edición de productos](#alta-y-edición-de-productos-admin-products-new--edit)
   - [Seguimiento de bodega](#seguimiento-de-bodega-admin-bodega)
   - [Branding y contenido](#branding-y-contenido-del-sitio-admin-site-content)
   - [Configuración de correos](#configuración-de-correos-de-contacto-admin-contact-settings)
   - [Gestión de billeteras](#gestión-de-billeteras-de-pago-admin-payment-wallets)
   - [Solicitudes de pago](#solicitudes-de-pago-admin-payment-requests)
   - [Pagos y conciliación](#pagos-y-conciliación-admin-payments)
   - [Planes y precios](#planes-y-precios-admin-plans)
   - [Suscripciones](#suscripciones-admin-subscriptions)
   - [SEO y metadatos](#seo-y-metadatos-admin-seo)
   - [Tutoriales](#tutoriales-admin-tutorials)
   - [Videos promocionales](#videos-promocionales-admin-videos)
   - [Estado del sitio](#estado-del-sitio-admin-site-status)
   - [Configuración general de la app](#configuración-general-de-la-app-admin-app-settings)
   - [Recursos de marketing](#recursos-de-marketing-admin-marketing)
   - [Impersonación de usuarios](#impersonación-de-usuarios-admin-impersonate)
   - [Edición de fases y recompensas](#edición-de-fases-y-recompensas-admin-phase-rewards)
4. [Seguridad y control de acceso](#seguridad-y-control-de-acceso)
5. [Localización y soporte multi-idioma](#localización-y-soporte-multi-idioma)
6. [Flujos de datos y contratos](#flujos-de-datos-y-contratos)
7. [Operación diaria y checklist](#operación-diaria-y-checklist)
8. [Solución de problemas](#solución-de-problemas)
9. [Referencias y archivos clave](#referencias-y-archivos-clave)

## Acceso y prerrequisitos
- Todas las pantallas viven bajo `/admin` y comparten layout (`src/app/admin/layout.tsx`).
- Se requiere un usuario autenticado con rol `admin` definido en `profiles.role`. Las comprobaciones se realizan mediante `src/components/admin-guard.tsx` y los middleware de API.
- Variables imprescindibles en el entorno (ver `.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY` y variables de remitente para correos de contacto.
- Para ambientes locales ejecutar `npm run dev` y acceder a `http://localhost:3000/admin` tras iniciar sesión.

## Arquitectura del panel
- **Feature-first**: cada módulo vive en `src/modules/<feature>` e incluye controladores, servicios, repositorios, vistas y hooks.
- **Separación de responsabilidades**:
  - *Controllers* coordinan eventos y estado UI (por ejemplo, `src/modules/orders/fulfillment/controllers/order-fulfillment-controller.tsx`).
  - *Services* encapsulan lógica de negocio y orquestación (ver `order-fulfillment-service.ts`).
  - *Repositories* implementan el acceso a datos (por ejemplo, `order-fulfillment-repository.ts`).
- **Patrones aplicados**:
  - *Factory*: cada módulo expone un factory como `order-fulfillment-module.ts` para crear dependencias con inyección de configuraciones.
  - *Observer/Event Bus*: `order-fulfillment-event-bus.ts` difunde eventos UI (refresh, filters, haptics).
  - *Error Boundary*: vistas como `order-fulfillment-error-state.tsx` y componentes análogos en otros módulos manejan errores resilientes.
- **Localización**: todas las cadenas residen en `src/i18n/dictionaries`. Cada módulo declara claves en `admin.ts` y las traducciones se encuentran en `locales/<idioma>.ts`.

## Navegación y páginas principales
El menú lateral se define en `src/modules/admin/layout/views/admin-sidebar-view.tsx` y registra las rutas desde `admin-sidebar-controller.tsx`. A continuación, se documenta cada sección.

### Dashboard (`/admin/dashboard`)
- Tarjetas con totales de usuarios, productos, suscripciones, revenue y unidades disponibles.
- Datos reales: `getProductsCount()`, `getUsersCount()` y `getProductStockSummary()`; suscripciones y revenue son métricas mock hasta integrar el pipeline financiero.
- Componentes clave: `src/app/admin/dashboard/page.tsx` y `src/modules/admin/dashboard/*`.
- Buenas prácticas: tras cada despliegue, validar que las tarjetas carguen en menos de 2s en mobile (<3G).

### Pedidos del día (`/admin/orders`)
- Página enfocada en logística diaria; lista pedidos confirmados con nombre del cliente, ID, dirección, items, cantidades y costos unitarios/totales.
- **Fuente de datos**: endpoint `GET /api/admin/orders/fulfillment` que consulta la vista `order_fulfillment_view` definida en `docs/database/full-schema.sql` y migrada en `docs/migrations/20250112_create_order_fulfillment_view.sql`.
- **Autorización**: el handler (`src/app/api/admin/orders/fulfillment/route.ts`) valida sesión y rol antes de crear el cliente de servicio. Retorna 401/403 en caso de fallar.
- **Estado UI**:
  - Loading: `order-fulfillment-loading-state.tsx` optimizado para mobile-first.
  - Error: `order-fulfillment-error-state.tsx` con opción de reintentar.
  - Empty: `order-fulfillment-empty-state.tsx` con mensajes localizados.
- **Interacciones**:
  - Toolbar (`order-fulfillment-toolbar.tsx`) permite elegir la fecha objetivo, refrescar manualmente y descargar un CSV listo para la bodega, además de mostrar la zona horaria de referencia.
  - Resumen (`order-fulfillment-summary.tsx`) agrega métricas de total pedidos, unidades, subtotal, impuestos, envío y descuentos.
  - Lista (`order-fulfillment-list.tsx`) muestra cada pedido con detalles de contacto y desglose de líneas.
  - Hooks (`use-order-fulfillment.ts`, `use-order-fulfillment-events.ts`, `use-order-fulfillment-haptics.ts`) gestionan fetch, sincronización y feedback háptico.
- **Recomendaciones operativas**:
  - Utilizar el botón **Descargar CSV** para obtener un archivo con los pedidos, direcciones y totales listos para impresión o importación.
  - Confirmar que la vista se recarga al arrastrar hacia abajo en mobile (pull-to-refresh).
  - Verificar totales contra el ERP una vez por jornada.

### Gestión de usuarios (`/admin/users`)
- Tabla con avatar, rol, estado y fecha de alta, alimentada desde `/api/admin/users`.
- Acciones rápidas via menú contextual para editar o ver detalles.
- Vistas complementarias:
  - **Detalle** (`/admin/users/details/[id]`): lectura con métricas de referidos y estado.
  - **Edición** (`/admin/users/edit/[id]`): formulario controlado con `UpdateUserProfileSchema`, incluye normalización de `commission_rate`.
- Recomendación: registrar cambios críticos en `audit-log-service` para trazabilidad.

### Gestión de productos (`/admin/products`)
- Tabla principal con miniaturas del primer elemento de `product.images`.
- Acciones: crear, editar, eliminar (con confirmación; sustituir `confirm()` por diálogo accesible es un pendiente).
- Formularios (`ProductForm`) permiten subir múltiples imágenes; se procesan con `uploadProductImages()` hacia el bucket `products`.
- Campo obligatorio **Unidades en inventario** alimenta el dashboard y el sitio público.

### Alta y edición de productos (`/admin/products/new`, `/admin/products/edit/[id]`)
- Formularios basados en `ProductForm` reutilizan validaciones de `ProductSchema` para garantizar datos consistentes.
- Flujos incluyen previsualización de imágenes, selección de categorías y control de precios por presentación.
- Las páginas cliente ejecutan `POST/PUT` contra `/api/admin/products` apoyándose en `createProduct`/`updateProduct` (servicio Supabase) y en `ProductForm` para controlar estado, loaders y toasts.
- Recomendaciones: validar traducciones de títulos/descripciones antes de publicar y verificar que `inventory_quantity` nunca sea negativo.

### Seguimiento de bodega (`/admin/bodega`)
- Registro manual de eventos logísticos para cada orden.
- **Datos**: opera sobre la tabla `warehouse_tracking_entries` usando los endpoints `GET/POST /api/admin/warehouse/entries` y `PATCH /api/admin/warehouse/entries/[id]`.
- **Formulario** (`WarehouseTrackingForm`): el ID de la orden se selecciona desde el buscador (autocompleta con el código real de la orden), el sistema genera automáticamente un código de seguimiento inmutable y luego se completan estado (`pending`, `packed`, `in_transit`, `delivered`, `delayed`, `canceled`), empresa responsable, ubicación actual, nota interna, fecha del evento y ETA.
- **Filtros**: búsqueda por orden/código/ubicación, selector de estado y botón para limpiar filtros.
- **Mobile-first**: cards con safe areas, scroll infinito (`useInfiniteScroll`), estados vacíos/error/localizados y feedback háptico (`useWarehouseTrackingHaptics`).
- **Seguridad**: valida sesión `admin` antes de instanciar el cliente `service_role` (patrón Repository + Factory en `warehouse-tracking-repository.ts`).
- **Impacto en clientes**: `ProfileSummaryService` expone `orders[].tracking`; la pestaña de pedidos en el perfil muestra la empresa responsable, ubicación, código de seguimiento y ETA junto con el estado principal.
- **Sincronización de estados**: cuando una orden está pagada/completada y aún no tiene eventos en Bodega, el perfil del usuario la mostrará como `pending`. Cada nuevo evento registrado en Bodega actualiza automáticamente el estado que ve el cliente.
- **Tips operativos**: completar siempre la empresa responsable (se precarga desde `profiles.fulfillment_company`), normalizar fechas en formato ISO, compartir el código generado con el cliente cuando solicite seguimiento y usar la búsqueda por ID/código/ubicación para encontrar actualizaciones previas.

### Branding y contenido del sitio (`/admin/site-content`)
- Pestaña **Header**: nombre de la app, logo, favicon (upload o URL), alineación y visibilidad del texto.
- Pestaña **Landing**: gestiona hero, sobre nosotros, roadmap, testimonios, productos destacados, contacto (con correo configurable) y FAQs por idioma.
- Pestaña **Footer**: tagline, enlaces, perfiles sociales y toggles de idioma/tema.
- Validaciones: `SiteBrandingUpdateSchema` y `LandingContentUpdateSchema` antes de persistir en Supabase.
- Archivos asociados en `src/modules/site-content/*`.

### Configuración de correos de contacto (`/admin/contact-settings`)
- Carga valores de `contact_settings` y fusiona overrides desde variables de entorno.
- Configura remitente, `reply-to`, destinatario alterno, listas CC/BCC y prefijo de asunto.
- Soporta auto-respuesta con tokens `{{name}}` y `{{email}}`.
- Tarjeta **Email provider status** valida `RESEND_API_KEY`, `CONTACT_FROM_NAME` y `CONTACT_FROM_EMAIL`.
- Endpoint: `PUT /api/admin/contact-settings`; requiere `SUPABASE_SERVICE_ROLE_KEY` en el backend.
- Para pasos completos consultar `docs/contact-email-setup.md`.

### Gestión de billeteras de pago (`/admin/payment-wallets`)
- Consolida cuentas de pago internas y externas vinculadas a socios o distribuidores.
- La vista cliente hace fetch a `/api/admin/payment-wallets` y permite editar campos en línea; las actualizaciones via `PATCH` persisten cambios mediante `PaymentWalletService` + `PaymentWalletRepository` (patrón Repository) en el backend.
- Las wallets residen en la tabla `payment_wallets`; cada fila incluye `balance_cents`, `currency`, `type`, límites `min_amount_cents` / `max_amount_cents` y `is_default`.
- Buenas prácticas: confirmar que la wallet predeterminada corresponde al país/segmento correcto y registrar cambios en el audit log.

#### Ajustes rápidos desde la ficha de usuario (`/admin/users/edit/[id]`)
- Secciones **Wallet Settings** y **Network Earnings Settings** permiten ajustes manuales controlados por `AdminUpdateUserSchema` (ver `src/app/api/admin/users/[id]/route.ts`).
- Diferencias clave:
  - **Wallet**: saldo líquido que vive en `wallets.balance_cents` y se refleja en compras inmediatas.
  - **Network earnings**: comisiones acumuladas en `network_commissions.available_cents`; el usuario puede transferirlas a su wallet cuando lo decida.
- Cada formulario muestra saldo actual (solo lectura), campo editable para nuevo saldo/ganancia y nota interna opcional para auditoría.
- El delta entre valores actual y nuevo se calcula en el servicio; genera transacciones `wallet_txns` (`type = admin_adjustment`, `metadata.source = 'admin-user-edit'`) o entradas en `network_commissions` con `member_id = '00000000-0000-0000-0000-000000000001'` para distinguir ajustes manuales.
- Validaciones clave: valores numéricos >= 0, notas recomendadas, control de concurrencia vía `updated_at`.
- Reglas operativas:
  - Documentar siempre el motivo del ajuste; en Wallet la nota queda en `wallet_txns.metadata.note` y aparece en el historial visible para el usuario. Para Network Earnings la nota se envía junto al payload y, mientras el repositorio incorpora soporte de metadatos, se recomienda duplicarla en `audit-log-service`.
  - Para restar fondos se ingresa el nuevo total deseado (el sistema calcula la diferencia y aplica un cargo negativo).
  - Después de guardar, confirmar en la pestaña **History** que la transacción quedó registrada y visible para el usuario.

#### Escenarios frecuentes
- **Pago externo recibido**: aumentar el saldo del wallet y dejar evidencia en la nota (ej. "Pago en efectivo recibido - $100").
- **Corrección de comisión**: ajustar `network earnings` a la cifra correcta y detallar el motivo (ej. "Corrección por error en cálculo de comisiones noviembre").
- **Bonificación**: añadir fondos adicionales en cualquiera de las secciones y registrar el incentivo otorgado.

### Solicitudes de pago (`/admin/payment-requests`)
- Listado maestro de retiros solicitados por la red de ventas, con filtros por estado y modal de detalle (`Dialog`).
- Flujo de aprobación/rechazo invoca `/api/admin/payment-requests/[id]/approve|reject`; ambos endpoints instancian `PaymentWalletService` para acreditar fondos con `WalletService.addFunds()` o marcar rechazo.
- Al aprobar se registra la nota administrativa, se actualiza la solicitud a `completed` y se muestra toast de confirmación.
- Indicadores visuales mediante `Badge` para estados `pending`, `processing`, `completed`, `rejected`; incluye vínculo a comprobantes (`external_url`).
- Checklist: documentar motivo (motivo, fecha, responsable) en `adminNotes` y verificar que la wallet asociada esté activa.

### Pagos y conciliación (`/admin/payments`)
- La experiencia se divide en dos rutas:
  - **Historial (`/admin/payments/history`)**: renderiza `PaymentHistoryController`, el cual consulta `/api/admin/payments/history`, se apoya en `PaymentHistoryService` + `payment-history-supabase-repository.ts` y muestra transacciones por rango de fechas con paginación infinita.
  - **Resultado (`/admin/payments/result` con parámetros `provider`, `status`, `session_id`)**: pantalla `PaymentResultPage` validada con `PaymentProviderSchema` + `zod`, útil para revisar el desenlace de pruebas Stripe/PayPal.
- Los repositorios `supabase-payment-repository.ts` y servicios auxiliares viven en `src/modules/payments/*`, aplican el patrón Repository e inyección de cliente Supabase.
- Recomendaciones: ejecutar conciliaciones diarias exportando CSV desde el historial, revisar discrepancias con el gateway y habilitar `dynamic = 'force-dynamic'` cuando se necesite data fresca en SSR.

### Planes y precios (`/admin/plans`)
- Listado central de planes disponibles con datos de `membership_plans` (nombre, precio, beneficios, estado `is_active`).
- La tabla se alimenta mediante fetch a `/api/admin/plans`, valida la respuesta con `PlanSchema.array()` y muestra acciones de eliminación con confirmación.
- Formularios de **nuevo** (`/admin/plans/new`) y **edición** (`/admin/plans/edit/[id]`) reutilizan `PlanForm`, soportan campos en español/inglés y persisten con llamadas `POST/PUT` al mismo endpoint.
- Recomendaciones: mantener sincronizados `features` por idioma, confirmar `price` y `slug` únicos antes de publicar.
- Tip: tras cambios, ejecutar `npm run typecheck` para asegurar que `PlanSchema` siga alineado con el backend.

### Pagos (`/admin/pays`)
- Centraliza la configuración de pasarelas de pago para suscripciones recurrentes.
- Renderiza `AdminPaymentSettingsController` con textos localizados vía `getLocalizedDictionary`; el controlador gestiona Stripe/PayPal (activar/desactivar claves, validar sandbox/test info).
- Página de edición (`/admin/pays/edit/[id]`) expone formularios mock para planes `basic`, `pro`, `diamond`; útiles para capacitaciones y pruebas de contenido.
- Checklist: mantener `subscriptionTestInfo` actualizado para equipos de soporte y verificar que las claves se guarden en `SUPABASE_SERVICE_ROLE_KEY`/Resend según corresponda.

### SEO y metadatos (`/admin/seo`)
- Herramienta central para administrar títulos, descripciones, keywords y JSON-LD por idioma y página.
- La pantalla construye un estado local (`SeoFormState`) desde `/api/admin/seo`, organiza páginas por categoría y aplica validaciones manuales (incluye parseo de JSON-LD) antes de llamar a `/api/admin/seo` (`POST/PUT`).
- Presenta snippet preview simplificado mediante badges de prioridad y toggles `robots_index/follow`.
- Checklist: actualizar sitemap tras cambios relevantes y confirmar que `og:image` sea accesible públicamente.

### Tutoriales (`/admin/tutorials`)
- Repositorio de guías paso a paso para la red comercial; el formulario (`TutorialsForm`) permite crear, editar, reordenar y eliminar tutoriales.
- Consume `/api/admin/tutorials` (`GET/POST/PUT/DELETE`) y maneja internamente pasos (`content[]`) con títulos, descripciones e imágenes.
- Incluye switches para activar/desactivar tutoriales, loaders optimizados (`Loader2`) y toasts de éxito/error.
- Recomendaciones: mantener versiones multi-idioma sincronizadas y usar `is_active` para ocultar contenido en revisión.

### Videos promocionales (`/admin/videos`)
- Catálogo de videos embebidos (YouTube) y contenido destacado para la red.
- La tabla usa el hook `useAdminVideos` que encapsula fetch hacia `/api/admin/videos`, y expone acciones para publicar, destacar, editar y eliminar.
- Formularios (`/admin/videos/new`, `/admin/videos/edit/[id]`) validan `youtube_id`, miniaturas y campos multi-idioma antes de enviar `POST/PUT`.
- Tip operativo: verificar que los videos tengan subtítulos y descripciones en todos los idiomas soportados para accesibilidad.

### Estado del sitio (`/admin/site-status`)
- Panel que centraliza métricas de salud: uptime, latencia, colas de jobs y dependencias externas.
- `AdminSiteStatusExperience` consume `/api/admin/site-status`, arma tarjetas de estado y permite activar modo mantenimiento/banners por idioma.
- Buenas prácticas: antes de activar mantenimiento, configurar mensaje de fin estimado y validar que el modo se refleje en `public/maintenance.json`.

### Configuración general de la app (`/admin/app-settings`)
- Centraliza parámetros globales: límites de uploads, políticas de cancelación, parámetros de growth (bonos referidos) y toggles experimentales.
- `AppSettingsForm` carga ajustes desde `/api/admin/app-settings` y `phase-levels`, normaliza datos con `DEFAULT_APP_SETTINGS` y gestiona colecciones (earnings, capacities) en memoria.
- Al guardar envía payload `AppSettingsUpdateInput` validado en backend (patrón Repository en `AppSettingsService`).
- Antes de guardar, revisar los tooltips con impacto en front público y confirmar que los experimentos tengan fecha de expiración.

### Recursos de marketing (`/admin/marketing`)
- Biblioteca de assets descargables (imágenes, GIF) para equipos comerciales.
- Permite activar/desactivar recursos, ajustar orden de despliegue y administrar traducciones (`title_en`, `title_es`, `description_*`).
- La página usa Supabase directamente; pendiente migrar a `marketing-assets-service.ts` para alinearse con el patrón Repository.
- Flujo operativo: tras subir un asset, validar la vista pública y compartir el enlace acortado con los equipos.

### Impersonación de usuarios (`/admin/impersonate`)

La funcionalidad de **impersonación** permite a los administradores iniciar sesión como cualquier usuario para:
- Diagnosticar problemas reportados por usuarios
- Verificar permisos y accesos
- Probar funcionalidades desde la perspectiva del usuario
- Validar configuraciones de afiliado

#### Cómo Funciona

**Detección Automática:**
- El sistema detecta automáticamente cuando un admin está impersonando a un usuario
- Se muestra un banner persistente en la parte superior de todas las páginas
- El banner incluye:
  - Nombre del usuario impersonado
  - Email del usuario impersonado
  - Botón "Stop Impersonating" para volver a la sesión de admin

**Flujo de Impersonación:**

1. **Inicio de Impersonación** (desde `/admin/users`):
   ```typescript
   // El admin hace clic en "Impersonate" en el menú de usuario
   POST /api/admin/impersonate
   {
     "userId": "target-user-id"
   }
   ```

2. **Sesión de Impersonación**:
   - Se crea una nueva sesión con el usuario objetivo
   - Se guarda metadata en localStorage:
     ```typescript
     {
       "isImpersonating": true,
       "adminUserId": "admin-user-id",
       "targetUserId": "target-user-id",
       "startedAt": "2025-01-15T10:30:00Z"
     }
     ```
   - El banner de impersonación se muestra en todas las páginas

3. **Fin de Impersonación**:
   ```typescript
   // El admin hace clic en "Stop Impersonating"
   POST /api/admin/stop-impersonate
   ```
   - Se restaura la sesión original del admin
   - Se limpia la metadata de localStorage
   - Se redirige al admin dashboard

#### Componentes Clave

**Banner de Impersonación** (`src/components/impersonation-banner.tsx`):
```typescript
export function ImpersonationBanner() {
  const { isImpersonating, targetUser } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="bg-yellow-500 text-black p-2 text-center">
      <p>
        Impersonating: {targetUser.name} ({targetUser.email})
        <button onClick={stopImpersonating}>Stop Impersonating</button>
      </p>
    </div>
  );
}
```

**Hook de Impersonación** (`src/hooks/use-impersonation.ts`):
```typescript
export function useImpersonation() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);

  useEffect(() => {
    const metadata = localStorage.getItem('impersonation_metadata');
    if (metadata) {
      const data = JSON.parse(metadata);
      setIsImpersonating(true);
      // Fetch target user data
    }
  }, []);

  const stopImpersonating = async () => {
    await fetch('/api/admin/stop-impersonate', { method: 'POST' });
    localStorage.removeItem('impersonation_metadata');
    window.location.href = '/admin/dashboard';
  };

  return { isImpersonating, targetUser, stopImpersonating };
}
```

#### Seguridad

**Validaciones:**
- Solo usuarios con rol `admin` pueden impersonar
- Se registra cada impersonación en audit logs
- Se limita el tiempo de impersonación (máximo 1 hora)
- Se requiere re-autenticación del admin después de 30 minutos

**Audit Log:**
```typescript
await auditLogService.log({
  action: 'user_impersonation_started',
  adminUserId: adminId,
  targetUserId: userId,
  metadata: {
    adminEmail: admin.email,
    targetEmail: user.email,
    startedAt: new Date().toISOString(),
  }
});
```

#### Casos de Uso

**Caso 1: Diagnosticar Problema de Comisiones**
1. Usuario reporta que no recibe comisiones
2. Admin impersona al usuario
3. Admin navega a `/profile/payout-settings`
4. Admin verifica configuración de Stripe Connect
5. Admin identifica que falta conectar cuenta
6. Admin detiene impersonación y contacta al usuario

**Caso 2: Verificar Página de Afiliado**
1. Usuario reporta que su página de afiliado no funciona
2. Admin impersona al usuario
3. Admin navega a `/affiliate/{referralCode}`
4. Admin verifica que la página carga correctamente
5. Admin identifica que la suscripción está en waitlist
6. Admin actualiza el estado de suscripción

#### Recomendaciones Operativas

- ✅ Siempre informar al usuario cuando se va a impersonar
- ✅ Registrar el motivo de la impersonación en notas internas
- ✅ Limitar la impersonación al tiempo mínimo necesario
- ✅ No realizar acciones críticas (compras, cambios de contraseña) mientras se impersona
- ✅ Verificar que el banner de impersonación sea visible en todas las páginas

### Edición de fases y recompensas (`/admin/phase-rewards`)

El sistema de **fases y recompensas** permite configurar los beneficios que reciben los usuarios según su nivel de actividad en la red MLM.

#### Estructura de Fases

**Fases Disponibles:**
- **Phase 0**: Usuario nuevo sin actividad
- **Phase 1**: Usuario con 1-4 referidos directos activos
- **Phase 2**: Usuario con 5-9 referidos directos activos
- **Phase 3**: Usuario con 10+ referidos directos activos

**Configuración por Fase** (tabla `phase_levels`):
```sql
CREATE TABLE phase_levels (
  id UUID PRIMARY KEY,
  phase INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  commission_rate DECIMAL(5,4) NOT NULL,           -- Ecommerce Earnings (%)
  subscription_discount_rate DECIMAL(5,4) NOT NULL, -- Group Gain (%)
  min_active_referrals INTEGER NOT NULL,
  max_active_referrals INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

#### Interfaz de Edición

**Formulario de Edición** (`/admin/phase-rewards/edit/[phase]`):

```typescript
interface PhaseRewardsForm {
  phase: number;                      // 0, 1, 2, 3
  name: string;                       // "Starter", "Bronze", "Silver", "Gold"
  description: string;                // Descripción de la fase
  commissionRate: number;             // 0.08, 0.15, 0.30, 0.40
  subscriptionDiscountRate: number;   // 0.00, 0.10, 0.15, 0.20
  minActiveReferrals: number;         // 0, 1, 5, 10
  maxActiveReferrals: number | null;  // 0, 4, 9, null
}
```

**Campos Editables:**
1. **Name**: Nombre de la fase (ej: "Starter", "Bronze", "Silver", "Gold")
2. **Description**: Descripción de los beneficios
3. **Ecommerce Earnings (%)**: Porcentaje de comisión por ventas en tienda de afiliado
4. **Group Gain (%)**: Porcentaje adicional para patrocinadores
5. **Min Active Referrals**: Mínimo de referidos directos activos requeridos
6. **Max Active Referrals**: Máximo de referidos directos activos (null = sin límite)

#### Flujo de Actualización

**Endpoint:** `PUT /api/admin/phase-rewards/[phase]`

```typescript
// Request
{
  "name": "Gold",
  "description": "Elite tier with maximum benefits",
  "commissionRate": 0.40,
  "subscriptionDiscountRate": 0.20,
  "minActiveReferrals": 10,
  "maxActiveReferrals": null
}

// Response
{
  "success": true,
  "phase": {
    "id": "uuid",
    "phase": 3,
    "name": "Gold",
    "commission_rate": 0.40,
    "subscription_discount_rate": 0.20,
    "min_active_referrals": 10,
    "max_active_referrals": null
  }
}
```

#### Cálculo Automático de Fases

El sistema calcula automáticamente la fase de cada usuario basándose en:

**Criterios:**
1. Número de referidos directos activos
2. Estado de suscripción de los referidos (`status = 'active'`, `waitlisted = false`)

**Servicio de Cálculo** (`src/modules/phase-levels/services/phase-calculator-service.ts`):
```typescript
export class PhaseCalculatorService {
  async calculateUserPhase(userId: string): Promise<number> {
    // 1. Obtener referidos directos activos
    const activeReferrals = await this.getActiveReferrals(userId);

    // 2. Contar referidos activos
    const count = activeReferrals.length;

    // 3. Determinar fase según configuración
    const phases = await this.phaseLevelRepository.list();

    for (const phase of phases.sort((a, b) => b.phase - a.phase)) {
      if (count >= phase.min_active_referrals) {
        if (!phase.max_active_referrals || count <= phase.max_active_referrals) {
          return phase.phase;
        }
      }
    }

    return 0; // Default: Phase 0
  }
}
```

#### Impacto en el Sistema

**Cuando se actualiza una fase:**
1. Se recalculan las fases de todos los usuarios afectados
2. Se actualizan las comisiones futuras según los nuevos rates
3. Las comisiones ya generadas NO se modifican
4. Se notifica a los usuarios que cambiaron de fase (opcional)

**Ejemplo de Impacto:**
```typescript
// Antes: Phase 2 = 30% Ecommerce Earnings
// Después: Phase 2 = 35% Ecommerce Earnings

// Usuario A (Phase 2) hace una venta de $100
// Antes: $100 × 30% = $30.00
// Después: $100 × 35% = $35.00
```

#### Validaciones

**Reglas de Negocio:**
- `commissionRate` debe estar entre 0.00 y 1.00 (0% - 100%)
- `subscriptionDiscountRate` debe estar entre 0.00 y 1.00
- `minActiveReferrals` debe ser >= 0
- `maxActiveReferrals` debe ser > `minActiveReferrals` o null
- No puede haber gaps en los rangos de referidos

**Validación de Rangos:**
```typescript
// Ejemplo de configuración válida:
Phase 0: 0 referidos (min: 0, max: 0)
Phase 1: 1-4 referidos (min: 1, max: 4)
Phase 2: 5-9 referidos (min: 5, max: 9)
Phase 3: 10+ referidos (min: 10, max: null)

// Ejemplo de configuración INVÁLIDA:
Phase 0: 0 referidos (min: 0, max: 0)
Phase 1: 1-4 referidos (min: 1, max: 4)
Phase 2: 7-9 referidos (min: 7, max: 9) ❌ Gap entre 5-6
Phase 3: 10+ referidos (min: 10, max: null)
```

#### Recomendaciones Operativas

- ✅ Comunicar cambios de configuración a la red con anticipación
- ✅ Realizar cambios en horarios de baja actividad
- ✅ Documentar el motivo de cada cambio en notas internas
- ✅ Verificar que los rangos no tengan gaps
- ✅ Probar en ambiente de staging antes de aplicar en producción
- ✅ Monitorear el impacto en comisiones después de cambios

#### Archivos Relacionados

- `src/app/admin/phase-rewards/page.tsx` - Listado de fases
- `src/app/admin/phase-rewards/edit/[phase]/page.tsx` - Edición de fase
- `src/modules/phase-levels/services/phase-calculator-service.ts` - Cálculo de fases
- `src/modules/phase-levels/repositories/phase-level-repository.ts` - Repositorio de fases
- `src/app/api/admin/phase-rewards/[phase]/route.ts` - API de actualización

## Seguridad y control de acceso
- **Principio de menor privilegio**: la API de fulfillment y otras rutas admin solo instancian el cliente de servicio tras validar sesión activa y rol `admin`.
- **Audit logs**: utilizar `src/lib/services/audit-log-service.ts` para registrar acciones críticas (ediciones de usuarios, cambios de stock, exportaciones masivas).
- **Políticas de Supabase**: mantener revisadas las políticas RLS; la migración de la vista de fulfillment crea columnas calculadas usando `COALESCE` para evitar fugas de datos nulos.
- **Health checks**: monitorear `/api/health` y configurar alertas cuando falle.

## Localización y soporte multi-idioma
- Diccionarios base: `src/i18n/dictionaries/default.ts` (namespace general) y `src/i18n/dictionaries/admin.ts` (sección administrativa).
- Traducciones por idioma en `src/i18n/dictionaries/locales/<idioma>.ts` (ejemplo `es.ts`).
- Para añadir un idioma:
  1. Extender `default.ts` y `admin.ts` con nuevas claves descriptivas.
  2. Agregar traducciones en cada archivo dentro de `locales`.
  3. Verificar que todos los componentes utilicen hooks de `next-intl` con las claves actualizadas.
- Las vistas de pedidos utilizan claves como `orders.fulfillment.title`, `orders.fulfillment.summary.*`, etc.; mantenerlas sincronizadas.

## Flujos de datos y contratos
- **Vista SQL**: `order_fulfillment_view` combina órdenes, usuarios y líneas para exponer métricas agregadas; definida en `docs/database/database.sql` y migrada con `docs/migrations/20250112_create_order_fulfillment_view.sql` (incluye backfill de `tax_cents`, `shipping_cents`, `discount_cents`).
- **APIs**:
  - `/api/admin/orders/fulfillment`: GET con filtros de fecha, estado y búsqueda; responde con `OrderFulfillmentSnapshot` definido en `order-fulfillment.ts`.
  - `/api/admin/users`, `/api/admin/products`, `/api/admin/contact-settings` y otros endpoints siguen contratos tipados en `types`.
- **State management**: hooks en cada módulo mantienen estado local (loading/error/data) y exponen acciones de actualización; se apoya en el event bus para sincronizar UI y servicios.

## Operación diaria y checklist
1. Verificar `Dashboard` para métricas globales y stock.
2. Abrir `Pedidos del día`:
   - Validar la fecha actual (se auto selecciona) o elegir otra con el selector.
   - Descargar el CSV del día y compartirlo con la bodega o sistema de mensajería.
   - Registrar incidencias en el ERP/auditoría.
3. Revisar solicitudes de usuarios en `Gestión de usuarios` (altas, roles, bloqueos).
4. Actualizar catálogo si existen cambios (`Gestión de productos`).
5. Ajustar contenido de landing según campañas vigentes (`Branding y contenido`).
6. Confirmar que los correos de contacto se envíen correctamente (`Configuración de correos`).
7. Ejecutar `npm run lint` y pruebas relevantes antes de desplegar cambios administrativos.

## Solución de problemas
- **401/403 en `/api/admin/orders/fulfillment`**: verificar sesión activa, rol del usuario y presencia de `SUPABASE_SERVICE_ROLE_KEY`.
- **Vista de pedidos vacía**: confirmar que existen órdenes para la fecha seleccionada y que la migración `20250112_create_order_fulfillment_view.sql` se aplicó.
- **Errores de traducción (`Missing message`)**: revisar claves en `admin.ts` y traducciones en `locales`.
- **Cargas lentas**: activar el modo debug del event bus y revisar logs en consola; optimizar consultas o añadir paginación.
- **Fallo de envío de correos**: validar credenciales de Resend y revisar logs de `contact_settings`.

## Referencias y archivos clave
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/orders/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/users/edit/[id]/page.tsx`
- `src/app/admin/products/page.tsx`
- `src/app/admin/products/product-form.tsx`
- `src/app/admin/products/new/page.tsx`
- `src/modules/orders/fulfillment/*`
- `src/app/admin/payment-wallets/page.tsx`
- `src/modules/payment-wallets/services/payment-wallet-service.ts`
- `src/app/api/admin/payment-requests/[id]/approve/route.ts`
- `src/app/admin/payments/history/page.tsx`
- `src/modules/payments/history/controllers/payment-history-controller.tsx`
- `src/modules/payments/history/services/payment-history-service.ts`
- `src/app/admin/payments/result/page.tsx`
- `src/app/admin/plans/page.tsx`
- `src/app/admin/plans/new/page.tsx`
- `src/app/admin/plans/edit/[id]/page.tsx`
- `src/app/admin/pays/page.tsx`
- `src/app/admin/pays/edit/[id]/page.tsx`
- `src/app/admin/seo/page.tsx`
- `src/app/admin/tutorials/page.tsx`
- `src/app/admin/videos/page.tsx`
- `src/hooks/use-admin-videos.ts`
- `src/app/admin/site-status/page.tsx`
- `src/modules/site-status/ui/admin-site-status-experience.tsx`
- `src/app/admin/app-settings/page.tsx`
- `src/app/admin/app-settings/app-settings-form.tsx`
- `docs/database/full-schema.sql`
- `docs/migrations/20250112_create_order_fulfillment_view.sql`
- `docs/contact-email-setup.md`

> Mantén esta guía actualizada cada vez que se añadan nuevas secciones, endpoints o flujos administrativos para garantizar que el panel sea autoexplicativo y operativo para cualquier equipo.
