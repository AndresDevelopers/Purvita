# Categorías de Marketing Multi-idioma - Frontend

## Cambios Implementados

### 1. Página de Admin de Marketing (`src/app/admin/marketing/page.tsx`)

#### Nuevas Interfaces
```typescript
interface MarketingCategory {
  id: string;
  slug: string;
  name: string;
  display_order: number;
}
```

#### Nuevos Estados
- `categories`: Array de categorías cargadas desde la base de datos
- `category_id`: ID de la categoría seleccionada en el formulario

#### Nuevas Funciones
- `fetchCategories()`: Carga las categorías desde la función SQL `get_marketing_categories('es')`

#### Cambios en el Formulario
- **Antes**: Campo de texto libre con datalist
- **Ahora**: Select dropdown con categorías multi-idioma

El select muestra los nombres en español (puedes cambiar el locale en `fetchCategories`).

### 2. Flujo de Datos

```
1. Al cargar la página:
   - fetchCategories() → Carga categorías desde DB
   - fetchAssets() → Carga assets existentes

2. Al crear/editar un asset:
   - Usuario selecciona categoría del dropdown
   - Se guarda category_id (UUID) y category (slug) en la DB
   
3. Al mostrar assets:
   - Se puede filtrar por category_id
   - Se muestra el nombre localizado de la categoría
```

## Características

### ✅ Implementado
- [x] Carga de categorías multi-idioma desde la DB
- [x] Select dropdown con categorías en español
- [x] Guardado de `category_id` al crear/editar assets
- [x] Compatibilidad con campo `category` legacy
- [x] Manejo de errores si no se pueden cargar categorías

### 🔄 Próximas Mejoras (Opcionales)

#### 1. Gestión de Categorías en el Admin
Crear una sección para que los admins puedan:
- Ver todas las categorías
- Crear nuevas categorías (con nombres en ES e EN)
- Editar categorías existentes
- Activar/desactivar categorías
- Reordenar categorías

#### 2. Selector de Idioma
Permitir al admin cambiar el idioma del dropdown:
```typescript
const [adminLocale, setAdminLocale] = useState<'es' | 'en'>('es');

const fetchCategories = useCallback(async () => {
  const { data } = await supabase
    .rpc('get_marketing_categories', { locale_param: adminLocale });
  setCategories(data || []);
}, [adminLocale]);
```

#### 3. Mostrar Categorías en la Vista de Usuario
Actualizar `src/app/[lang]/marketing/marketing-assets.tsx` para:
- Cargar categorías con el idioma del usuario
- Mostrar nombres localizados en los filtros

## Ejemplo de Uso

### Crear una Nueva Categoría (SQL)
```sql
INSERT INTO public.marketing_categories(slug, name_en, name_es, display_order)
VALUES ('promotions', 'Promotions', 'Promociones', 5);
```

### Obtener Categorías en el Frontend
```typescript
// En español
const { data: categoriesES } = await supabase
  .rpc('get_marketing_categories', { locale_param: 'es' });

// En inglés
const { data: categoriesEN } = await supabase
  .rpc('get_marketing_categories', { locale_param: 'en' });
```

### Filtrar Assets por Categoría
```typescript
const { data: assets } = await supabase
  .from('marketing_assets')
  .select('*')
  .eq('category_id', selectedCategoryId)
  .eq('is_active', true);
```

## Migración de Datos Existentes

Los assets existentes se migran automáticamente cuando ejecutas el script SQL:
- Assets con `category = 'general'` → Categoría "General"
- Assets con `category = 'social media'` → Categoría "Social Media"
- Assets sin categoría → Categoría "General" (por defecto)

## Estructura de la Base de Datos

### Tabla: `marketing_categories`
```sql
id              uuid PRIMARY KEY
slug            text UNIQUE NOT NULL
name_en         text NOT NULL
name_es         text NOT NULL
is_active       boolean DEFAULT TRUE
display_order   integer DEFAULT 0
created_at      timestamptz
updated_at      timestamptz
```

### Tabla: `marketing_assets` (actualizada)
```sql
-- Campos nuevos:
category_id     uuid REFERENCES marketing_categories(id)

-- Campos existentes (legacy):
category        text DEFAULT 'general'
```

## Testing

### Verificar que las Categorías se Cargan
1. Abre la página de admin de marketing
2. Haz clic en "Agregar recurso"
3. Verifica que el dropdown de categorías muestra:
   - General
   - Redes Sociales
   - Correo Electrónico
   - Banners
   - Videos

### Verificar que se Guarda Correctamente
1. Crea un nuevo asset y selecciona una categoría
2. Guarda el asset
3. Verifica en la base de datos:
```sql
SELECT 
  ma.title,
  ma.category,
  mc.name_es,
  mc.name_en
FROM marketing_assets ma
LEFT JOIN marketing_categories mc ON ma.category_id = mc.id
ORDER BY ma.created_at DESC
LIMIT 5;
```

## Troubleshooting

### Las categorías no se cargan
**Problema**: El dropdown está vacío o muestra solo "Selecciona una categoría"

**Solución**:
1. Verifica que ejecutaste el script SQL de migración
2. Verifica que la función `get_marketing_categories` existe:
```sql
SELECT * FROM get_marketing_categories('es');
```
3. Revisa la consola del navegador para errores

### Error al guardar assets
**Problema**: Error al crear/editar assets

**Solución**:
1. Verifica que la columna `category_id` existe en `marketing_assets`
2. Verifica que las políticas RLS permiten insertar/actualizar
3. Asegúrate de que el `category_id` seleccionado existe en la tabla

### Los nombres están en inglés en lugar de español
**Problema**: El dropdown muestra nombres en inglés

**Solución**:
Cambia el locale en `fetchCategories`:
```typescript
const { data } = await supabase
  .rpc('get_marketing_categories', { locale_param: 'es' }); // Cambiar a 'es'
```

## Notas Importantes

- ⚠️ El campo `category` (texto) se mantiene por compatibilidad pero eventualmente debería eliminarse
- ✅ Siempre usa `category_id` para nuevas funcionalidades
- ✅ Las categorías inactivas no aparecen en el dropdown
- ✅ Solo los admins pueden gestionar categorías (RLS)

