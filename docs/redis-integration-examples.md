# Ejemplos de Integración de Redis

Esta guía proporciona ejemplos prácticos de cómo integrar Redis en diferentes partes de la aplicación PūrVita.

> **⚠️ IMPORTANTE**: Redis **solo se activa en producción** (`NODE_ENV=production`). En desarrollo, todos estos ejemplos usarán caché en memoria automáticamente.

## Tabla de Contenidos

1. [Caché de Configuración](#1-caché-de-configuración)
2. [Caché de Perfiles de Usuario](#2-caché-de-perfiles-de-usuario)
3. [Caché de Productos](#3-caché-de-productos)
4. [Rate Limiting en API Routes](#4-rate-limiting-en-api-routes)
5. [Rate Limiting en Server Actions](#5-rate-limiting-en-server-actions)
6. [Contadores y Métricas](#6-contadores-y-métricas)
7. [Sesiones Temporales](#7-sesiones-temporales)
8. [Invalidación de Caché](#8-invalidación-de-caché)

---

## 1. Caché de Configuración

### Problema
La configuración de la app se consulta frecuentemente pero cambia raramente.

### Solución
Usar el helper de caché con Redis.

```typescript
// src/app/api/settings/route.ts
import { getCachedAppSettings } from '@/lib/helpers/cached-settings-helper';

export async function GET() {
  // Obtiene de Redis si está disponible, sino de memoria
  const settings = await getCachedAppSettings();
  
  return Response.json(settings);
}
```

### Invalidar después de actualizar

```typescript
// src/app/api/admin/app-settings/route.ts
import { invalidateAppSettingsCache } from '@/lib/helpers/cached-settings-helper';
import { updateAppSettings } from '@/modules/app-settings/services/app-settings-service';

export async function PUT(request: Request) {
  const body = await request.json();
  
  // Actualizar en base de datos
  const updated = await updateAppSettings(body);
  
  // Invalidar caché
  await invalidateAppSettingsCache();
  
  return Response.json(updated);
}
```

---

## 2. Caché de Perfiles de Usuario

### Problema
Los perfiles de usuario se consultan en cada petición pero cambian poco.

### Solución

```typescript
// src/lib/services/user-profile-service.ts
import { redisCache, CacheKeys } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

export async function getUserProfile(userId: string) {
  return await redisCache.getOrSet(
    CacheKeys.userProfile(userId),
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    600 // 10 minutos
  );
}

export async function updateUserProfile(userId: string, updates: any) {
  const supabase = await createClient();
  
  // Actualizar en base de datos
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  
  // Invalidar caché
  await redisCache.delete(CacheKeys.userProfile(userId));
  
  return data;
}
```

---

## 3. Caché de Productos

### Problema
El catálogo de productos se consulta frecuentemente en la tienda.

### Solución

```typescript
// src/modules/products/services/cached-product-service.ts
import { redisCache, CacheKeys } from '@/lib/redis';
import { getProducts, getProductById } from './product-service';

export async function getCachedProducts() {
  return await redisCache.getOrSet(
    CacheKeys.products(),
    async () => await getProducts(),
    300 // 5 minutos
  );
}

export async function getCachedProduct(productId: string) {
  return await redisCache.getOrSet(
    CacheKeys.product(productId),
    async () => await getProductById(productId),
    600 // 10 minutos
  );
}

export async function invalidateProductCache(productId?: string) {
  if (productId) {
    // Invalidar producto específico
    await redisCache.delete(CacheKeys.product(productId));
  }
  
  // Invalidar lista de productos
  await redisCache.delete(CacheKeys.products());
}
```

### Uso en componente

```typescript
// src/app/shop/page.tsx
import { getCachedProducts } from '@/modules/products/services/cached-product-service';

export default async function ShopPage() {
  const products = await getCachedProducts();
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

---

## 4. Rate Limiting en API Routes

### Problema
Proteger endpoints de API contra abuso.

### Solución - Básica

```typescript
// src/app/api/contact/route.ts
import { rateLimit, getRateLimitHeaders, RateLimitPresets } from '@/lib/utils/rate-limit';

export async function POST(request: Request) {
  // Obtener identificador (IP o user ID)
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  
  // Aplicar rate limit estricto (5 req/min)
  const result = await rateLimit(ip, RateLimitPresets.strict);
  
  if (!result.success) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: getRateLimitHeaders(result)
      }
    );
  }
  
  // Procesar petición...
  const body = await request.json();
  // ... lógica de contacto
  
  return Response.json(
    { success: true },
    { headers: getRateLimitHeaders(result) }
  );
}
```

### Solución - Con Middleware Helper

```typescript
// src/app/api/newsletter/subscribe/route.ts
import { withRateLimit, RateLimitPresets } from '@/lib/utils/rate-limit';

export async function POST(request: Request) {
  // Verificar rate limit
  const rateLimitResponse = await withRateLimit(request, RateLimitPresets.strict);
  if (rateLimitResponse) {
    return rateLimitResponse; // Retorna 429 si excede límite
  }
  
  // Procesar suscripción...
  const body = await request.json();
  // ... lógica de newsletter
  
  return Response.json({ success: true });
}
```

---

## 5. Rate Limiting en Server Actions

### Problema
Proteger server actions contra abuso.

### Solución

```typescript
// src/app/actions/send-message.ts
'use server';

import { rateLimit } from '@/lib/utils/rate-limit';
import { headers } from 'next/headers';

export async function sendMessage(formData: FormData) {
  // Obtener IP del usuario
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'anonymous';
  
  // Rate limit: 3 mensajes por minuto
  const result = await rateLimit(ip, { limit: 3, window: 60 });
  
  if (!result.success) {
    return {
      error: 'Too many messages. Please wait before sending another.',
      retryAfter: result.reset,
    };
  }
  
  // Procesar mensaje...
  const message = formData.get('message');
  // ... lógica de envío
  
  return { success: true };
}
```

---

## 6. Contadores y Métricas

### Problema
Rastrear visitas, clics, o eventos en tiempo real.

### Solución

```typescript
// src/lib/analytics/track-product-view.ts
import { redisCache } from '@/lib/redis';

export async function trackProductView(productId: string) {
  const key = `analytics:product:${productId}:views`;
  
  // Incrementar contador
  await redisCache.increment(key);
  
  // Establecer expiración de 24 horas si es nuevo
  const ttl = await redisCache.ttl(key);
  if (ttl === -1) {
    await redisCache.expire(key, 86400); // 24 horas
  }
}

export async function getProductViews(productId: string): Promise<number> {
  const key = `analytics:product:${productId}:views`;
  const views = await redisCache.get<number>(key);
  return views || 0;
}

export async function trackUserAction(userId: string, action: string) {
  const key = `analytics:user:${userId}:${action}`;
  await redisCache.increment(key);
  await redisCache.expire(key, 86400); // 24 horas
}
```

### Uso en componente

```typescript
// src/app/products/[id]/page.tsx
import { trackProductView, getProductViews } from '@/lib/analytics/track-product-view';

export default async function ProductPage({ params }: { params: { id: string } }) {
  // Rastrear vista (fire and forget)
  trackProductView(params.id).catch(console.error);
  
  // Obtener número de vistas
  const views = await getProductViews(params.id);
  
  return (
    <div>
      <h1>Producto</h1>
      <p>{views} vistas en las últimas 24 horas</p>
    </div>
  );
}
```

---

## 7. Sesiones Temporales

### Problema
Almacenar datos temporales de sesión (carritos, formularios multi-paso).

### Solución

```typescript
// src/lib/session/cart-session.ts
import { redisCache } from '@/lib/redis';

interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

export async function saveCart(sessionId: string, items: CartItem[]) {
  const key = `session:cart:${sessionId}`;
  await redisCache.set(key, items, 3600); // 1 hora
}

export async function getCart(sessionId: string): Promise<CartItem[]> {
  const key = `session:cart:${sessionId}`;
  const cart = await redisCache.get<CartItem[]>(key);
  return cart || [];
}

export async function clearCart(sessionId: string) {
  const key = `session:cart:${sessionId}`;
  await redisCache.delete(key);
}

export async function addToCart(sessionId: string, item: CartItem) {
  const cart = await getCart(sessionId);
  
  // Buscar si el producto ya existe
  const existingIndex = cart.findIndex(i => i.productId === item.productId);
  
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  
  await saveCart(sessionId, cart);
}
```

---

## 8. Invalidación de Caché

### Patrón: Invalidar al Actualizar

```typescript
// src/modules/products/services/product-service.ts
import { redisCache, CacheKeys } from '@/lib/redis';

export async function updateProduct(productId: string, updates: any) {
  // 1. Actualizar en base de datos
  const updated = await database.update(productId, updates);
  
  // 2. Invalidar caché del producto
  await redisCache.delete(CacheKeys.product(productId));
  
  // 3. Invalidar lista de productos
  await redisCache.delete(CacheKeys.products());
  
  return updated;
}
```

### Patrón: Invalidar por Patrón

```typescript
// Invalidar todos los datos de un usuario
export async function invalidateUserCache(userId: string) {
  await redisCache.deletePattern(`user:${userId}:*`);
}

// Invalidar todas las traducciones de un idioma
export async function invalidateTranslationCache(locale: string) {
  await redisCache.deletePattern(`i18n:${locale}:*`);
}
```

### Patrón: Invalidación Programada

```typescript
// src/lib/cron/cache-cleanup.ts
export async function scheduledCacheCleanup() {
  // Ejecutar cada hora
  console.log('Running scheduled cache cleanup...');
  
  // Invalidar cachés que deben refrescarse
  await redisCache.delete(CacheKeys.products());
  await redisCache.deletePattern('analytics:*');
  
  console.log('Cache cleanup completed');
}
```

---

## Mejores Prácticas

### 1. Usar TTL Apropiados

```typescript
// Datos estáticos: TTL largo
await redisCache.set('app:version', '1.0.0', 86400); // 24 horas

// Datos dinámicos: TTL medio
await redisCache.set(CacheKeys.products(), products, 300); // 5 minutos

// Datos en tiempo real: TTL corto
await redisCache.set(CacheKeys.userWallet(userId), wallet, 30); // 30 segundos
```

### 2. Siempre Invalidar al Actualizar

```typescript
async function updateData(id: string, data: any) {
  await database.update(id, data);
  await redisCache.delete(CacheKeys.data(id)); // ✅ Siempre invalidar
}
```

### 3. Usar Claves Consistentes

```typescript
// ✅ Bueno - Usar CacheKeys
const key = CacheKeys.userProfile(userId);

// ❌ Malo - Strings hardcodeados
const key = `user-${userId}-profile`;
```

### 4. Manejar Errores Gracefully

```typescript
// El cliente Redis ya maneja errores internamente
const data = await redisCache.get('key');
if (data === null) {
  // No hay caché o error, consultar base de datos
  return await fetchFromDatabase();
}
return data;
```

---

## Recursos Adicionales

- [Documentación completa de Redis](../redis-setup.md)
- [Código fuente del cliente Redis](../../src/lib/redis.ts)
- [Utilidades de rate limiting](../../src/lib/utils/rate-limit.ts)
- [Helper de caché de configuración](../../src/lib/helpers/cached-settings-helper.ts)

