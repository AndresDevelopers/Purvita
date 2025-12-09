# Sistema de Facturas - PūrVita

Este documento consolida toda la información sobre el sistema de facturas para órdenes de compra y suscripciones.

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Historial de Órdenes](#historial-de-órdenes)
- [Facturas de Suscripción](#facturas-de-suscripción)
- [Generación de Facturas](#generación-de-facturas)
- [Seguimiento de Pedidos](#seguimiento-de-pedidos)
- [API Endpoints](#api-endpoints)
- [Internacionalización](#internacionalización)
- [Troubleshooting](#troubleshooting)

---

## Descripción General

El sistema de facturas permite a los usuarios:
- Ver historial completo de compras (productos y suscripciones)
- Descargar facturas en formato PDF/HTML
- Rastrear estado de pedidos con información de bodega
- Archivar y gestionar facturas antiguas

---

## Historial de Órdenes

### Ubicación

**Pestaña "Orders"** en `/[lang]/profile`

### Información Mostrada

- Fecha de la orden
- Monto total
- Productos/Suscripción comprada
- Estado (sincronizado con Bodega)
- Seguimiento manual (empresa, ubicación, código, ETA)
- Botón para descargar factura

### Estados de Pedidos

Los estados se sincronizan con la tabla `warehouse_tracking_entries`:

| Estado | Descripción |
|--------|-------------|
| `pending` | Pago completado, esperando procesamiento en bodega |
| `packed` | Pedido empacado y listo para envío |
| `in_transit` | En tránsito hacia el cliente |
| `delivered` | Entregado al cliente |
| `delayed` | Retraso en el envío |
| `canceled` | Pedido cancelado |

**Nota**: Mientras el pago esté marcado como completado y no existan eventos en Bodega, el estado mostrado permanece en "Pendiente".

### Búsqueda de Órdenes

Campo de búsqueda que filtra por:
- ID de orden
- Estado
- Nombre de productos

### Seguimiento Manual

Cada pedido muestra:
- **Empresa responsable**: Compañía de envío (precargada desde `profiles.fulfillment_company`)
- **Ubicación actual**: Última ubicación conocida
- **Código de seguimiento**: Generado automáticamente por Bodega
- **ETA**: Fecha estimada de entrega

---

## Facturas de Suscripción

### Ubicación

**Página de Suscripción**: `/[lang]/subscription`

### Características

#### 1. Listado Completo de Facturas

- **Fuente de datos**: Tabla `public.payments` (registros con `kind = 'subscription'`)
- **Columnas mostradas**:
  - Fecha
  - Monto
  - Estado
  - Cobertura (period_end)
  - Método de pago
  - Acciones disponibles

#### 2. Buscador

Filtra por:
- Fecha
- Estado
- Método de pago
- Monto

#### 3. Gestión de Archivados

- Las facturas pueden archivarse o restaurarse masivamente
- Nuevo campo `payments.archived BOOLEAN NOT NULL DEFAULT FALSE`
- Endpoints protegidos para archivar y desarchivar

#### 4. Visor de Facturas en HTML

- Endpoint: `GET /api/subscription/invoices/[invoiceId]/invoice`
- Reutiliza la plantilla común de facturas
- Muestra comprobante imprimible
- Cuando existe `period_end` se informa la fecha hasta la que cubre la suscripción

---

## Generación de Facturas

### Endpoint Principal

**Ruta**: `GET /api/orders/[orderId]/invoice`

**Método**: Genera HTML que se puede imprimir/guardar como PDF

**Seguridad**: Solo el propietario de la orden puede descargar su factura

### Información en la Factura

#### Encabezado
- Logo y nombre de la empresa (PūrVita Network)
- Número de factura
- Fecha de emisión
- Estado del pago

#### Información del Cliente
- Nombre
- Email
- Teléfono
- Dirección completa

#### Detalles de Pago
- Método de pago (PayPal, Stripe, Wallet)
- ID de transacción (si aplica)

#### Productos/Servicios
- Descripción
- Cantidad
- Precio unitario
- Total por línea

#### Totales
- Subtotal
- Descuentos (si aplica)
- Impuestos (si aplica)
- Envío (si aplica)
- **Total final**

### Uso para Usuarios

1. Ir a tu perfil
2. Hacer clic en la pestaña "Orders" / "Pedidos"
3. Buscar la orden deseada (opcional)
4. Hacer clic en "Download PDF" / "Descargar PDF"
5. Se abrirá una ventana con la factura
6. Usar el diálogo de impresión para:
   - Guardar como PDF
   - Imprimir directamente

---

## Seguimiento de Pedidos

### Integración con Bodega

El sistema de seguimiento se integra con el módulo de bodega (`/admin/bodega`):

#### Tabla `warehouse_tracking_entries`

```sql
warehouse_tracking_entries (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending','packed','in_transit','delivered','delayed','canceled')),
  responsible_company TEXT,
  tracking_code TEXT DEFAULT public.generate_warehouse_tracking_code(),
  location TEXT,
  note TEXT,
  estimated_delivery DATE,
  event_time TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ
)
```

#### Sincronización de Estados

1. Cuando una orden está pagada/completada y aún no tiene eventos en Bodega, el perfil del usuario la mostrará como `pending`
2. Cada nuevo evento registrado en Bodega actualiza automáticamente el estado que ve el cliente
3. El código de seguimiento es generado automáticamente y se mantiene inmutable
4. La empresa responsable se precarga desde `profiles.fulfillment_company`

---

## API Endpoints

### Órdenes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/orders/[orderId]/invoice` | Genera HTML imprimible de la factura |

### Suscripciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/subscription/invoices` | Lista las facturas del usuario autenticado |
| `POST` | `/api/subscription/invoices/archive` | Archiva las facturas enviadas |
| `POST` | `/api/subscription/invoices/unarchive` | Restaura facturas archivadas |
| `GET` | `/api/subscription/invoices/[invoiceId]/invoice` | Devuelve el HTML imprimible de la factura |

**Seguridad**: Todos los endpoints requieren sesión activa y utilizan RLS de Supabase.

---

## Internacionalización

### Claves de Diccionario

#### Historial de Órdenes

```typescript
orderHistory: {
  title: "Order History",
  description: "View and manage your past orders.",
  searchPlaceholder: "Search orders...",
  table: {
    date: "Date",
    amount: "Amount",
    productSubscription: "Product/Subscription",
    status: "Status",
    invoice: "Invoice",
  },
  downloadInvoice: "Download PDF",
  downloadingInvoice: "Generating...",
  statuses: {
    paid: "Completed",
    pending: "Pending",
    packed: "Packed",
    in_transit: "In transit",
    delivered: "Delivered",
    delayed: "Delayed",
    canceled: "Canceled",
  },
  empty: "No orders yet.",
  subscriptionFallback: "Subscription payment",
}
```

#### Facturas de Suscripción

```typescript
subscriptionManagement: {
  invoiceHistory: {
    title: "Invoice History",
    description: "View and manage your subscription invoices",
    searchPlaceholder: "Search invoices...",
    showArchived: "Show Archived",
    showActive: "Show Active",
    archive: "Archive",
    unarchive: "Unarchive",
    viewInvoice: "View Invoice",
    empty: "No invoices found",
  }
}
```

### Idiomas Soportados

- **Inglés** (`en`): `src/i18n/dictionaries/default.ts`
- **Español** (`es`): `src/i18n/dictionaries/locales/es.ts`

---

## Estructura de Base de Datos

### Tabla `orders`

```sql
orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  status TEXT, -- 'paid', 'pending', 'canceled'
  total_cents BIGINT,
  tax_cents BIGINT,
  shipping_cents BIGINT,
  discount_cents BIGINT,
  currency TEXT DEFAULT 'USD',
  gateway TEXT, -- 'paypal', 'stripe', 'wallet'
  gateway_transaction_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### Tabla `order_items`

```sql
order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  qty INTEGER, -- Campo principal para INSERT/UPDATE
  quantity INTEGER, -- Alias generado (solo lectura, siempre = qty)
  price_cents BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```

**Notas**:
- `qty` es el campo principal - úsalo para INSERT/UPDATE
- `quantity` es un alias generado automáticamente que siempre refleja el valor de `qty`
- Ambos campos pueden usarse en SELECT queries

### Tabla `payments`

```sql
payments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  kind TEXT, -- 'subscription', 'order', 'wallet_topup'
  amount_cents BIGINT,
  currency TEXT DEFAULT 'USD',
  status TEXT, -- 'pending', 'completed', 'failed', 'refunded'
  gateway TEXT, -- 'paypal', 'stripe', 'wallet'
  gateway_transaction_id TEXT,
  period_end TIMESTAMPTZ, -- Para suscripciones
  archived BOOLEAN NOT NULL DEFAULT FALSE, -- Para gestión de archivados
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

---

## Migración

### Agregar Campo `archived` a `payments`

Archivo: `docs/migrations/20250331_add_archived_to_payments.sql`

```sql
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.payments
SET archived = FALSE
WHERE archived IS NULL;
```

---

## UI

### Diseño Mobile-First

- Campos táctiles de 44px
- Estados de carga, vacío y error visibles
- Botones para cambiar entre facturas activas y archivadas
- Visor modal reutilizable compatible con escritorio y móvil

### Componentes

- `src/app/[lang]/profile/page.tsx` - Página de perfil con pestaña de órdenes
- `src/app/[lang]/subscription/page.tsx` - Página de suscripción con historial de facturas
- `src/app/api/orders/[orderId]/invoice/route.ts` - Generación de facturas de órdenes
- `src/app/api/subscription/invoices/route.ts` - Listado de facturas de suscripción

---

## Seguridad

### Validaciones Implementadas

1. **Autenticación requerida**: Todos los endpoints requieren sesión activa
2. **Verificación de propiedad**: Se valida que la factura corresponda al usuario (`payments.user_id`, `orders.user_id`)
3. **Sanitización HTML**: El HTML de facturas sanitiza strings mediante `escapeHtml` para prevenir inyección
4. **RLS de Supabase**: Políticas de seguridad a nivel de base de datos

---

## Troubleshooting

### La factura no se descarga

**Posibles causas**:
- Navegador bloquea pop-ups
- Error en la consola del navegador
- Orden no existe o no pertenece al usuario

**Solución**:
1. Verificar que el navegador permita pop-ups
2. Revisar la consola del navegador para errores
3. Verificar que la orden existe y pertenece al usuario

### Datos faltantes en la factura

**Posibles causas**:
- Perfil del usuario incompleto
- Items de la orden sin productos asociados
- Campos opcionales vacíos (tax, shipping, discount)

**Solución**:
1. Verificar que el perfil del usuario esté completo
2. Revisar que los items de la orden tengan productos asociados
3. Verificar los campos opcionales

### Error 404 al descargar

**Posibles causas**:
- ID de la orden incorrecto
- Orden no pertenece al usuario autenticado

**Solución**:
1. Verificar que el ID de la orden sea correcto
2. Confirmar que la orden pertenece al usuario autenticado

### Estado de pedido no se actualiza

**Posibles causas**:
- No hay eventos registrados en Bodega
- Sincronización pendiente

**Solución**:
1. Verificar que existan eventos en `warehouse_tracking_entries` para la orden
2. Registrar evento inicial en Bodega si no existe
3. Refrescar la página del perfil

---

## Mejoras Futuras

1. **Envío por Email**: Agregar opción para enviar factura por correo
2. **Descarga Directa PDF**: Usar librería como `pdfkit` o `puppeteer` para generar PDFs del lado del servidor
3. **Personalización**: Permitir a los admins personalizar el diseño de la factura
4. **Múltiples Monedas**: Soporte para diferentes monedas
5. **Notas**: Agregar campo de notas en las órdenes
6. **Tracking Automático**: Integración con APIs de empresas de envío
7. **Exportación a PDF**: Desde el visor de facturas de suscripción
8. **Filtros Avanzados**: Por estado y método de pago
9. **Notificaciones**: Por email cuando se genere una nueva factura

---

## Referencias

### Archivos Clave

- `src/app/[lang]/profile/page.tsx` - Perfil con historial de órdenes
- `src/app/[lang]/subscription/page.tsx` - Suscripción con historial de facturas
- `src/app/api/orders/[orderId]/invoice/route.ts` - Generación de facturas de órdenes
- `src/app/api/subscription/invoices/route.ts` - API de facturas de suscripción
- `src/app/api/subscription/invoices/[invoiceId]/invoice/route.ts` - Visor de facturas
- `src/app/admin/bodega/page.tsx` - Gestión de bodega y seguimiento

### Documentación Relacionada

- [Guía de Administración](admin-guide.md) - Sección de Bodega
- [Sistema de Pagos](payment-system.md) - Checkout y pasarelas
- [Modelos de Datos](data-models.md) - Esquemas de base de datos

---

**Última actualización**: 2025-10-24
**Versión**: 2.0
**Estado**: ✅ Implementado y Documentado
