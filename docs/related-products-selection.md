# Selección de Productos Relacionados

## Descripción

Esta funcionalidad permite a los administradores seleccionar manualmente qué productos se mostrarán como "productos relacionados" en las páginas de detalles de productos, tanto en la página principal como en las páginas de afiliados.

## Características

### 1. Selector de Productos Relacionados en Admin

- **Ubicación**: Formulario de creación/edición de productos en `/admin/products`
- **Componente**: `RelatedProductsSelector`
- **Funcionalidad**:
  - Permite seleccionar múltiples productos relacionados
  - Búsqueda por nombre, slug o descripción
  - Vista previa de productos seleccionados con badges
  - Excluye automáticamente el producto actual de la lista

### 2. Filtrado por Disponibilidad de País

Los productos relacionados solo se muestran si están disponibles en el país del usuario:

- **Página principal de productos** (`/[lang]/products/[slug]`):
  - Filtra productos relacionados en el cliente basándose en `cart_visibility_countries`
  - Solo muestra productos que tienen el país del usuario en su lista de países permitidos

- **Página de afiliados** (`/[lang]/affiliate/[referralCode]/product/[slug]`):
  - Filtra productos relacionados tanto en servidor como en cliente
  - Doble verificación para asegurar que solo se muestren productos disponibles

### 3. Lógica de Productos Relacionados

El repositorio de productos (`SupabaseProductRepository.listRelated`) implementa la siguiente lógica:

1. **Si el producto tiene IDs de productos relacionados configurados**:
   - Obtiene los productos específicos por sus IDs
   - Mantiene el orden configurado por el administrador
   - Filtra productos que ya no existen

2. **Si no hay productos relacionados configurados**:
   - Comportamiento por defecto: muestra 3 productos aleatorios
   - Excluye el producto actual

## Modelo de Datos

### Tabla `products`

Nueva columna agregada:

```sql
related_product_ids text[] NOT NULL DEFAULT '{}' ::text[]
```

### Schema Zod

```typescript
related_product_ids: z
  .preprocess((value) => normalizeProductIds(value), z.array(z.string()))
  .transform((ids) => Array.from(new Set(ids.map((id) => id.trim()))))
  .default([])
```

## Migración

Para aplicar los cambios a la base de datos, ejecuta:

```sql
-- Ver: docs/database/migrations/add_related_product_ids.sql
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS related_product_ids text[] NOT NULL DEFAULT '{}' ::text[];
```

## Uso

### Como Administrador

1. Ve a `/admin/products`
2. Crea o edita un producto
3. En la sección "Productos relacionados":
   - Haz clic en "Gestionar productos"
   - Busca y selecciona los productos que quieres mostrar como relacionados
   - Los productos seleccionados aparecerán como badges
   - Haz clic en "Cerrar" para guardar la selección
4. Guarda el producto

### Como Usuario Final

- Los productos relacionados aparecen automáticamente al final de la página de detalles del producto
- Solo verás productos relacionados que estén disponibles en tu país
- Si no hay productos relacionados configurados o disponibles, la sección no se mostrará

## Archivos Modificados

### Backend
- `src/lib/models/definitions.ts` - Schema de Product actualizado
- `src/modules/products/data/repositories/supabase-product-repository.ts` - Lógica de listRelated
- `docs/database/full-schema.sql` - Schema de base de datos actualizado

### Frontend - Admin
- `src/app/admin/products/product-form.tsx` - Integración del selector
- `src/modules/products/ui/related-products-selector.tsx` - Nuevo componente selector

### Frontend - Cliente
- `src/app/[lang]/products/[slug]/product-detail-client.tsx` - Filtrado por país
- `src/app/[lang]/affiliate/[referralCode]/product/[slug]/affiliate-product-detail-client.tsx` - Filtrado por país

## Consideraciones

1. **Rendimiento**: Los productos relacionados se cargan en la misma consulta que el producto principal
2. **Orden**: Los productos relacionados se muestran en el orden configurado por el administrador
3. **Disponibilidad**: Solo se muestran productos que tengan configurados países de disponibilidad
4. **Fallback**: Si no hay productos relacionados configurados, se muestran productos aleatorios
5. **Límite**: Por defecto se muestran hasta 3 productos relacionados en la página de afiliados

## Testing

Para probar la funcionalidad:

1. Crea varios productos con diferentes configuraciones de países
2. Configura productos relacionados para un producto
3. Verifica que solo se muestren los productos disponibles en tu país
4. Cambia tu país en el perfil y verifica que los productos relacionados se actualicen

