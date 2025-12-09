# Funcionalidad de Archivado de Órdenes

## Resumen
Se ha implementado la funcionalidad completa para archivar y desarchivar órdenes en la página de perfil del usuario. Esta característica permite a los usuarios organizar mejor su historial de órdenes ocultando las órdenes antiguas o completadas sin eliminarlas de la base de datos.

## Cambios Realizados

### 1. Base de Datos

#### Migración SQL Ejecutada
Se ejecutó la migración para agregar la columna `archived` a la tabla `orders`:

```sql
-- Add archived column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for better performance when filtering archived orders
CREATE INDEX IF NOT EXISTS idx_orders_archived
ON public.orders(archived)
WHERE archived = FALSE;

-- Add comment to document the column
COMMENT ON COLUMN public.orders.archived IS 'Flag to indicate if an order has been archived by the user. Archived orders are hidden from the profile page but still exist in the database.';
```

**Ubicación de la migración:** `docs/migrations/add-archived-column-to-orders.sql`

**Esquema actualizado:** `docs/database/full-schema.sql` (líneas 3656-3675)

### 2. Backend

#### API Routes (Ya existentes)
- **`/api/orders/archive`** - Endpoint para archivar órdenes
- **`/api/orders/unarchive`** - Endpoint para desarchivar órdenes

Ambos endpoints ya estaban implementados y funcionando correctamente.

#### Tipos de Datos Actualizados

**`src/modules/multilevel/repositories/order-repository.ts`**
- Agregado campo `archived?: boolean` a la interfaz `OrderRecord`
- Actualizada la consulta SQL para incluir el campo `archived`
- Actualizado el mapeo de datos para incluir `archived: Boolean(row.archived ?? false)`

**`src/modules/profile/services/profile-summary-service.ts`**
- Actualizada la función `mapOrders` para incluir el campo `archived` en el objeto de retorno

**`src/modules/profile/domain/types.ts`**
- El campo `archived?: boolean` ya estaba presente en la interfaz `OrderSummary`

### 3. Frontend

#### Página de Perfil (`src/app/[lang]/profile/page.tsx`)

**Estados Agregados:**
```typescript
const [showArchivedOrders, setShowArchivedOrders] = useState(false);
const [unarchivingOrders, setUnarchivingOrders] = useState(false);
```

**Funciones Agregadas:**

1. **`handleUnarchiveOrders`** - Función para desarchivar órdenes seleccionadas
   - Llama al endpoint `/api/orders/unarchive`
   - Muestra notificación de éxito/error
   - Recarga el resumen de órdenes

2. **`archivedOrdersCount`** - Memo que cuenta las órdenes archivadas
   - Se usa para mostrar/ocultar el botón de ver archivadas
   - Muestra el número de órdenes archivadas en el botón

**Filtros Actualizados:**

```typescript
const filteredOrders = useMemo(() => {
  return (summary?.orders ?? [])
    .filter((order) => showArchivedOrders ? order.archived : !order.archived)
    .filter((order) => orderMatchesQuery(orderQuery, order));
}, [summary?.orders, orderQuery, showArchivedOrders]);
```

**UI Mejorada:**

1. **Botón "View Archived"** - Solo se muestra cuando hay órdenes archivadas
   - Muestra el número de órdenes archivadas
   - Alterna entre mostrar órdenes activas y archivadas
   - Cambia el texto a "Show Active Orders" cuando se están viendo archivadas

2. **Botón de Archivar/Desarchivar** - Cambia dinámicamente según el contexto
   - Cuando se ven órdenes activas: "Archive X Selected"
   - Cuando se ven órdenes archivadas: "Unarchive X Selected"
   - Muestra estado de carga apropiado

## Flujo de Usuario

### Archivar Órdenes
1. Usuario navega a la pestaña "Orders" en su perfil
2. Selecciona una o más órdenes usando los checkboxes
3. Hace clic en el botón "Archive X Selected"
4. Las órdenes se archivan y desaparecen de la vista principal
5. El contador de órdenes archivadas se actualiza

### Ver Órdenes Archivadas
1. Usuario hace clic en el botón "View Archived (X)" (solo visible si hay órdenes archivadas)
2. La vista cambia para mostrar solo las órdenes archivadas
3. El botón cambia a "Show Active Orders"

### Desarchivar Órdenes
1. Usuario está viendo órdenes archivadas
2. Selecciona una o más órdenes archivadas
3. Hace clic en el botón "Unarchive X Selected"
4. Las órdenes se desarchivan y vuelven a la vista principal
5. Si no quedan órdenes archivadas, la vista vuelve automáticamente a órdenes activas

## Características Técnicas

### Rendimiento
- Índice parcial en la columna `archived` para optimizar consultas de órdenes activas
- El índice solo incluye filas donde `archived = FALSE` para reducir el tamaño del índice

### Seguridad
- Validación de permisos: Los usuarios solo pueden archivar/desarchivar sus propias órdenes
- Autenticación requerida en todos los endpoints

### UX/UI
- Feedback visual inmediato con estados de carga
- Notificaciones toast para confirmar acciones
- Contador dinámico de órdenes archivadas
- Botones contextuales que cambian según el estado

## Archivos Modificados

1. **Base de Datos:**
   - `docs/database/full-schema.sql` - Esquema actualizado con columna archived
   - `docs/migrations/add-archived-column-to-orders.sql` - Migración SQL

2. **Backend:**
   - `src/modules/multilevel/repositories/order-repository.ts` - Tipo y consulta actualizados
   - `src/modules/profile/services/profile-summary-service.ts` - Mapeo actualizado

3. **Frontend:**
   - `src/app/[lang]/profile/page.tsx` - UI y lógica de archivado/desarchivado

4. **APIs (ya existentes):**
   - `src/app/api/orders/archive/route.ts` - Endpoint de archivado
   - `src/app/api/orders/unarchive/route.ts` - Endpoint de desarchivado

## Pruebas Recomendadas

1. **Archivar órdenes:**
   - Seleccionar una orden y archivarla
   - Seleccionar múltiples órdenes y archivarlas
   - Verificar que desaparecen de la vista principal

2. **Ver órdenes archivadas:**
   - Verificar que el botón solo aparece cuando hay órdenes archivadas
   - Verificar que muestra el número correcto de órdenes archivadas
   - Verificar que la vista cambia correctamente

3. **Desarchivar órdenes:**
   - Seleccionar una orden archivada y desarchivarla
   - Seleccionar múltiples órdenes archivadas y desarchivarlas
   - Verificar que vuelven a la vista principal

4. **Búsqueda:**
   - Verificar que la búsqueda funciona en órdenes activas
   - Verificar que la búsqueda funciona en órdenes archivadas

5. **Permisos:**
   - Intentar archivar órdenes de otro usuario (debe fallar)
   - Verificar que solo se muestran las órdenes del usuario autenticado

## Notas Adicionales

- Las órdenes archivadas NO se eliminan de la base de datos
- Los usuarios pueden desarchivar órdenes en cualquier momento
- El estado de archivado es independiente del estado de la orden (paid, pending, etc.)
- La funcionalidad de tracking y descarga de facturas funciona igual para órdenes archivadas

