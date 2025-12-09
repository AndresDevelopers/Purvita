# Tutorial Page Targeting - Documentación

## Resumen

El sistema de tutoriales ahora permite controlar **dónde se muestra cada tutorial**, con dos opciones:

1. **Mostrar en todas las páginas** - El tutorial aparece en cualquier página de la aplicación
2. **Páginas específicas** - El tutorial solo aparece en las páginas que especifiques

## Configuración en la Interfaz

### Ubicación
`/admin/tutorials` → Crear/Editar Tutorial → Sección "Dónde mostrar este tutorial"

### Opciones

#### 1. Mostrar en Todas las Páginas
```
☑ Mostrar en todas las páginas
```
- Activa este switch para que el tutorial aparezca en cualquier página
- Útil para tutoriales generales de bienvenida o introducción

#### 2. Páginas Específicas
```
☐ Mostrar en todas las páginas

Páginas específicas (una por línea):
/dashboard
/products
/team
/orders
```
- Desactiva el switch "Mostrar en todas las páginas"
- Ingresa las rutas de las páginas donde quieres que aparezca
- Una ruta por línea
- Soporta wildcards (ver más abajo)

## Formato de Rutas

### Rutas Exactas
```
/dashboard          → Solo en /dashboard
/products           → Solo en /products
/team               → Solo en /team
/orders             → Solo en /orders
```

### Rutas con Wildcard
```
/dashboard/*        → En /dashboard y todas sus subpáginas
                      (/dashboard/settings, /dashboard/profile, etc.)

/products/*         → En /products y todas sus subpáginas
                      (/products/123, /products/new, etc.)
```

## Ejemplos de Uso

### Ejemplo 1: Tutorial de Bienvenida General
**Configuración:**
```
☑ Mostrar en todas las páginas
```
**Resultado:** Aparece en todas las páginas de la aplicación

---

### Ejemplo 2: Tutorial del Dashboard
**Configuración:**
```
☐ Mostrar en todas las páginas

Páginas específicas:
/dashboard
```
**Resultado:** Solo aparece en `/dashboard`

---

### Ejemplo 3: Tutorial de Productos
**Configuración:**
```
☐ Mostrar en todas las páginas

Páginas específicas:
/products
/products/*
```
**Resultado:** Aparece en `/products` y todas sus subpáginas

---

### Ejemplo 4: Tutorial Multi-Página
**Configuración:**
```
☐ Mostrar en todas las páginas

Páginas específicas:
/dashboard
/team
/orders
```
**Resultado:** Aparece en `/dashboard`, `/team` y `/orders`

## Base de Datos

### Nuevas Columnas

```sql
-- Tabla: tutorials
show_on_all_pages  BOOLEAN DEFAULT false
target_pages       TEXT[] DEFAULT '{}'
```

### Estructura
```sql
CREATE TABLE tutorials (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  title_es TEXT,
  title_en TEXT,
  description TEXT,
  description_es TEXT,
  description_en TEXT,
  content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  show_on_all_pages BOOLEAN DEFAULT false,  -- ✨ Nuevo
  target_pages TEXT[] DEFAULT '{}',         -- ✨ Nuevo
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API

### Obtener Tutoriales para una Página

**Endpoint:** `GET /api/tutorials/for-page`

**Parámetros:**
- `path` (requerido) - Ruta de la página actual
- `locale` (opcional) - Idioma ('es' o 'en'), default: 'es'

**Ejemplo:**
```bash
GET /api/tutorials/for-page?path=/dashboard&locale=es
```

**Respuesta:**
```json
{
  "tutorials": [
    {
      "id": "uuid",
      "title": "Tutorial del Dashboard",
      "title_es": "Tutorial del Dashboard",
      "title_en": "Dashboard Tutorial",
      "description_es": "Aprende a usar el dashboard",
      "description_en": "Learn how to use the dashboard",
      "content": [...],
      "is_active": true,
      "show_on_all_pages": false,
      "target_pages": ["/dashboard"]
    }
  ],
  "count": 1,
  "page": "/dashboard",
  "locale": "es"
}
```

## Servicio de Tutoriales

### Funciones Disponibles

#### `getTutorialsForPage(pagePath, locale)`
Obtiene todos los tutoriales que deben mostrarse en una página específica.

```typescript
import { getTutorialsForPage } from '@/lib/services/tutorial-service';

const tutorials = await getTutorialsForPage('/dashboard', 'es');
```

#### `shouldShowTutorial(tutorial, pagePath)`
Verifica si un tutorial específico debe mostrarse en una página.

```typescript
import { shouldShowTutorial } from '@/lib/services/tutorial-service';

const show = shouldShowTutorial(tutorial, '/dashboard');
```

#### `getAllActiveTutorials()`
Obtiene todos los tutoriales activos (sin filtrar por página).

```typescript
import { getAllActiveTutorials } from '@/lib/services/tutorial-service';

const tutorials = await getAllActiveTutorials();
```

## Lógica de Filtrado

### Algoritmo
```typescript
function shouldShowTutorial(tutorial, pagePath) {
  // 1. Si no está activo, no mostrar
  if (!tutorial.is_active) return false;
  
  // 2. Si está configurado para todas las páginas, mostrar
  if (tutorial.show_on_all_pages) return true;
  
  // 3. Verificar si la página actual está en target_pages
  for (const targetPage of tutorial.target_pages) {
    // Coincidencia exacta
    if (targetPage === pagePath) return true;
    
    // Coincidencia con wildcard
    if (targetPage.endsWith('/*')) {
      const basePath = targetPage.slice(0, -2);
      if (pagePath.startsWith(basePath)) return true;
    }
  }
  
  return false;
}
```

## Casos de Uso

### 1. Tutorial de Onboarding General
**Escenario:** Nuevo usuario debe ver tutorial en todas las páginas

**Configuración:**
- ☑ Mostrar en todas las páginas
- is_active: true

**Resultado:** Aparece en cualquier página hasta que el usuario lo complete

---

### 2. Tutorial Específico de Funcionalidad
**Escenario:** Tutorial sobre cómo usar la sección de productos

**Configuración:**
- ☐ Mostrar en todas las páginas
- target_pages: ['/products', '/products/*']
- is_active: true

**Resultado:** Solo aparece en páginas relacionadas con productos

---

### 3. Tutorial Multi-Sección
**Escenario:** Tutorial que guía por varias secciones

**Configuración:**
- ☐ Mostrar en todas las páginas
- target_pages: ['/dashboard', '/team', '/products']
- is_active: true

**Resultado:** Aparece en las 3 páginas especificadas

---

### 4. Tutorial Desactivado Temporalmente
**Escenario:** Tutorial que no debe mostrarse ahora

**Configuración:**
- is_active: false
- (otras configuraciones no importan)

**Resultado:** No aparece en ninguna página

## Integración en Frontend

### Ejemplo: Componente de Página

```typescript
// app/dashboard/page.tsx
import { getTutorialsForPage } from '@/lib/services/tutorial-service';
import TutorialModal from '@/components/tutorial-modal';

export default async function DashboardPage() {
  const tutorials = await getTutorialsForPage('/dashboard', 'es');
  
  return (
    <div>
      <h1>Dashboard</h1>
      
      {tutorials.length > 0 && (
        <TutorialModal tutorials={tutorials} />
      )}
      
      {/* Resto del contenido */}
    </div>
  );
}
```

### Ejemplo: Hook de Cliente

```typescript
// hooks/use-page-tutorials.ts
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function usePageTutorials(locale: 'es' | 'en' = 'es') {
  const pathname = usePathname();
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTutorials() {
      try {
        const response = await fetch(
          `/api/tutorials/for-page?path=${pathname}&locale=${locale}`
        );
        const data = await response.json();
        setTutorials(data.tutorials || []);
      } catch (error) {
        console.error('Error fetching tutorials:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTutorials();
  }, [pathname, locale]);

  return { tutorials, loading };
}
```

## Mejores Prácticas

### 1. Organización de Tutoriales
- **Generales:** Usar "Mostrar en todas las páginas"
- **Específicos:** Usar páginas específicas
- **Secciones:** Usar wildcards para cubrir subsecciones

### 2. Nomenclatura de Rutas
```
✅ Correcto:
/dashboard
/products
/team

❌ Incorrecto:
dashboard (falta /)
/dashboard/ (barra final innecesaria)
```

### 3. Uso de Wildcards
```
✅ Correcto:
/products/*     → Cubre todas las subpáginas

❌ Incorrecto:
/products*      → No funcionará correctamente
```

### 4. Testing
Siempre prueba que el tutorial aparezca en las páginas correctas:
```bash
# Probar en diferentes páginas
/dashboard          → ¿Aparece?
/dashboard/settings → ¿Aparece si usaste wildcard?
/products           → ¿Aparece?
/team               → ¿No aparece si no está en la lista?
```

## Migración

La migración SQL ya incluye las nuevas columnas:

```sql
ALTER TABLE public.tutorials
  ADD COLUMN IF NOT EXISTS target_pages text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS show_on_all_pages boolean DEFAULT false;
```

Ejecutar con:
```bash
npx tsx scripts/migrate-tutorials-i18n.ts
```

## Troubleshooting

### Tutorial no aparece en ninguna página
**Verificar:**
1. ¿Está activo? (`is_active = true`)
2. ¿Tiene páginas configuradas o "mostrar en todas"?
3. ¿Las rutas están escritas correctamente?

### Tutorial aparece en páginas incorrectas
**Verificar:**
1. ¿Está activado "Mostrar en todas las páginas"?
2. ¿Las rutas en `target_pages` son correctas?
3. ¿Hay wildcards que cubren más de lo esperado?

### Wildcard no funciona
**Verificar:**
1. ¿Termina con `/*`? (no solo `*`)
2. ¿La ruta base es correcta?
3. Ejemplo: `/products/*` cubre `/products/123` pero no `/product/123`

## Próximos Pasos

1. ✅ Implementar UI de targeting
2. ✅ Crear servicio de filtrado
3. ✅ Crear API endpoint
4. ⏳ Integrar en páginas de usuario
5. ⏳ Agregar analytics de visualización
6. ⏳ Implementar sistema de progreso por página

## Recursos

- **Código:** `src/lib/services/tutorial-service.ts`
- **API:** `src/app/api/tutorials/for-page/route.ts`
- **UI:** `src/app/admin/tutorials/tutorials-form.tsx`
- **Migración:** `scripts/add-tutorials-i18n.sql`
