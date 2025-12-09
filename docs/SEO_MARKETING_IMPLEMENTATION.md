# 🚀 Guía de Implementación SEO y Marketing

Esta guía explica cómo configurar y usar las nuevas funcionalidades de SEO y marketing implementadas en PūrVita Network.

## 📋 Tabla de Contenidos

1. [Nuevas Funcionalidades](#nuevas-funcionalidades)
2. [Configuración Inicial](#configuración-inicial)
3. [Google Analytics 4](#google-analytics-4)
4. [Tracking de Eventos](#tracking-de-eventos)
5. [Datos Estructurados (Schema.org)](#datos-estructurados)
6. [Robots.txt](#robotstxt)
7. [Hreflang Tags](#hreflang-tags)
8. [Verificación](#verificación)

---

## 🎯 Nuevas Funcionalidades

### ✅ Implementado

1. **robots.txt dinámico** - Guía a los motores de búsqueda sobre qué rastrear
2. **Schema.org estructurado** - Datos estructurados para rich snippets
3. **Google Analytics 4** - Tracking de eventos y conversiones
4. **Pixel Events** - Eventos de conversión para Facebook y TikTok
5. **Hreflang tags** - SEO multiidioma (ES/EN)
6. **CSP actualizado** - Permite analytics sin comprometer seguridad

---

## ⚙️ Configuración Inicial

### 1. Scripts de Marketing (Admin Panel)

**⚠️ IMPORTANTE**: Todos los scripts de marketing se configuran desde el Admin Panel, **NO desde variables de entorno**.

#### Configurar desde Admin Panel

1. Ve a `/admin/advertising-scripts`
2. Configura los scripts que necesites:
   - **Facebook Pixel**: ID y script completo
   - **TikTok Pixel**: ID y script completo
   - **Google Tag Manager**: Container ID y script completo

**Ventajas de este sistema:**
- ✅ Cambios en tiempo real sin redeploy
- ✅ Activar/desactivar scripts individualmente
- ✅ Gestión visual desde el panel
- ✅ Protección automática en páginas de afiliados
- ✅ Respeta consentimiento de cookies

### 2. Google Analytics 4 (Opcional)

Si prefieres usar GA4 directamente (sin GTM), configura la variable de entorno:

```bash
# Google Analytics 4 (OPCIONAL)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Cómo obtener el Measurement ID:**

1. Ve a [Google Analytics](https://analytics.google.com/)
2. Crea una propiedad GA4 (si no tienes una)
3. Ve a **Admin** → **Data Streams** → Selecciona tu stream web
4. Copia el **Measurement ID** (formato: `G-XXXXXXXXXX`)
5. Agrégalo a tu `.env.local` o panel de hosting

**Nota:** Si usas Google Tag Manager desde el Admin Panel, NO necesitas esta variable.

---

## 📊 Google Analytics 4

### Configuración Automática

El componente `<GoogleAnalytics />` ya está integrado en el layout principal y rastrea automáticamente:

- ✅ Page views en cada navegación
- ✅ Eventos de conversión (compras, add to cart, etc.)
- ✅ Búsquedas
- ✅ Registros de usuarios

### Eventos Rastreados

Los siguientes eventos se rastrean automáticamente cuando ocurren:

| Evento | Cuándo se dispara | Datos incluidos |
|--------|-------------------|-----------------|
| `page_view` | Cada cambio de ruta | URL, título |
| `purchase` | Compra completada | ID orden, valor, productos |
| `add_to_cart` | Agregar al carrito | Producto, precio |
| `view_item` | Ver producto | Producto, precio |
| `begin_checkout` | Iniciar checkout | Valor total, productos |
| `sign_up` | Registro de usuario | Método de registro |
| `search` | Búsqueda | Término de búsqueda |

---

## 🎯 Tracking de Eventos

### Uso Básico

Importa las funciones de tracking en tus componentes:

```typescript
import {
  trackPurchase,
  trackAddToCart,
  trackViewContent,
  trackInitiateCheckout,
  trackCompleteRegistration,
  trackSearch,
} from '@/lib/marketing/pixel-events';
```

### Ejemplos de Uso

#### 1. Rastrear Compra

```typescript
trackPurchase(
  'order_123',           // Order ID
  99.99,                 // Total value
  'USD',                 // Currency
  [                      // Products
    {
      id: 'prod_1',
      name: 'Product Name',
      price: 99.99,
      quantity: 1,
    }
  ]
);
```

#### 2. Rastrear Add to Cart

```typescript
trackAddToCart({
  id: 'prod_1',
  name: 'Product Name',
  price: 49.99,
});
```

#### 3. Rastrear Vista de Producto

```typescript
trackViewContent({
  id: 'prod_1',
  name: 'Product Name',
  price: 49.99,
});
```

#### 4. Rastrear Registro

```typescript
trackCompleteRegistration('email'); // o 'google', 'facebook', etc.
```

### Integración Automática

Los eventos ya están integrados en:
- ✅ Páginas de productos (view_item)
- ✅ Carrito de compras (add_to_cart)
- ✅ Checkout (begin_checkout, purchase)
- ✅ Registro (sign_up)

---

## 🏷️ Datos Estructurados (Schema.org)

### Schemas Implementados

#### 1. Product Schema (Páginas de Productos)

Se genera automáticamente en `/[lang]/products/[slug]` e incluye:
- Nombre, descripción, imágenes
- Precio y disponibilidad
- Ratings y reviews (si existen)

#### 2. Organization Schema (Global)

Se genera en el layout principal e incluye:
- Nombre de la organización
- Logo
- URL del sitio

#### 3. WebSite Schema (Global)

Incluye:
- Nombre del sitio
- URL
- Search box para Google

### Verificar Datos Estructurados

1. Ve a [Google Rich Results Test](https://search.google.com/test/rich-results)
2. Ingresa la URL de tu producto
3. Verifica que aparezcan los datos estructurados

---

## 🤖 Robots.txt

El archivo `robots.txt` se genera dinámicamente en `/robots.txt` y:

- ✅ Permite rastreo de contenido público
- ✅ Bloquea áreas privadas (admin, dashboard, API)
- ✅ Incluye referencia al sitemap
- ✅ Configura crawl-delay para bots de IA

### Verificar

Visita: `https://tudominio.com/robots.txt`

---

## 🌍 Hreflang Tags

Los tags hreflang se generan automáticamente para SEO multiidioma:

```html
<link rel="alternate" hreflang="es" href="https://tudominio.com/es/products/producto" />
<link rel="alternate" hreflang="en" href="https://tudominio.com/en/products/producto" />
```

Esto ayuda a Google a mostrar la versión correcta del idioma a cada usuario.

---

## ✅ Verificación

### Checklist de Implementación

- [ ] Configurar scripts de marketing en `/admin/advertising-scripts` (Facebook, TikTok, GTM)
- [ ] (Opcional) Configurar `NEXT_PUBLIC_GA_MEASUREMENT_ID` si usas GA4 directamente
- [ ] Verificar que los scripts se cargan correctamente (F12 → Network)
- [ ] Verificar robots.txt: `https://tudominio.com/robots.txt`
- [ ] Verificar sitemap: `https://tudominio.com/sitemap.xml`
- [ ] Probar datos estructurados en [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Verificar hreflang tags en el código fuente

### Herramientas de Verificación

1. **Google Search Console**: Enviar sitemap y verificar indexación
2. **Google Analytics**: Verificar eventos en tiempo real
3. **Facebook Events Manager**: Verificar eventos de pixel
4. **TikTok Events Manager**: Verificar eventos de pixel

---

## 🎓 Recursos Adicionales

- [Documentación de Google Analytics 4](https://support.google.com/analytics/answer/9304153)
- [Schema.org Documentation](https://schema.org/)
- [Google Search Console](https://search.google.com/search-console)
- [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/)
- [TikTok Pixel Helper](https://ads.tiktok.com/help/article?aid=10000357)

---

## 🆘 Soporte

Si tienes problemas con la implementación:

1. Verifica que las variables de entorno estén configuradas correctamente
2. Revisa la consola del navegador para errores
3. Verifica que el CSP no esté bloqueando scripts (ya está configurado)
4. Consulta los logs del servidor para errores de backend

