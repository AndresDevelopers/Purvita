# Sistema de Caché - PūrVita

Este documento consolida toda la información sobre el sistema de caché implementado en PūrVita, que combina **Cloudflare CDN** y **Redis (Upstash)** para optimizar el rendimiento.

## 📋 Tabla de Contenidos

- [Resumen Ejecutivo](#resumen-ejecutivo)
- [Arquitectura de Caché](#arquitectura-de-caché)
- [Estrategia por Tipo de Contenido](#estrategia-por-tipo-de-contenido)
- [Configuración de Redis](#configuración-de-redis)
- [Configuración de Cloudflare](#configuración-de-cloudflare)
- [Comportamiento Dev vs Producción](#comportamiento-dev-vs-producción)
- [Verificación y Testing](#verificación-y-testing)
- [Ejemplos de Headers](#ejemplos-de-headers)
- [Troubleshooting](#troubleshooting)

---

## Resumen Ejecutivo

PūrVita implementa un sistema de caché de dos niveles:

1. **Cloudflare CDN**: Cachea assets estáticos y páginas públicas en el edge
2. **Redis (Upstash)**: Cachea datos de configuración y sesiones en el servidor

**Objetivos:**
- Mantener contenido dinámico personalizado para cada usuario
- Optimizar rendimiento y reducir carga en el servidor
- Reducir costos de hosting y base de datos
- Mejorar experiencia de usuario con tiempos de respuesta más rápidos

---

## Arquitectura de Caché

```
Usuario
  ↓
Cloudflare CDN (Edge Cache)
  ├─ HIT → Respuesta inmediata (assets, páginas públicas)
  └─ MISS/BYPASS → Continúa ↓
       ↓
Next.js Server (Vercel)
  ├─ Middleware aplica headers
  └─ Server Components ↓
       ↓
Redis Cache (Upstash)
  ├─ HIT → Datos cacheados (settings, config)
  └─ MISS → Continúa ↓
       ↓
Supabase Database (Source of Truth)
```

### Niveles de Caché

| Nivel | Tecnología | Propósito | TTL Típico |
|-------|-----------|-----------|------------|
| **Edge** | Cloudflare CDN | Assets estáticos, páginas públicas | 1 año (assets), 60s (páginas) |
| **Servidor** | Redis (Upstash) | Configuración, sesiones | 5 minutos |
| **Memoria** | Next.js Cache | Fallback cuando Redis no disponible | Variable |

---

## Estrategia por Tipo de Contenido

### 1. Páginas Dinámicas (Autenticadas)

**Ejemplos**: Dashboard, Perfil, Checkout, Wallet, Team

**Headers HTTP**:
```
Cache-Control: private, no-cache, no-store, must-revalidate
```

**Comportamiento**:
- ❌ Cloudflare NO cachea
- ✅ Redis cachea datos internos (settings, etc.)
- ✅ Cada usuario ve su contenido personalizado

**Rutas afectadas**:
- `/*/dashboard`
- `/*/profile`
- `/*/checkout`
- `/*/wallet`
- `/*/team`
- `/*/subscription`
- `/admin/*`

### 2. Páginas Públicas

**Ejemplos**: Landing, Productos, Términos

**Headers HTTP**:
```
Cache-Control: public, s-maxage=60, stale-while-revalidate=120
```

**Comportamiento**:
- ✅ Cloudflare cachea por 60 segundos
- ✅ Sirve contenido viejo mientras revalida (hasta 120s)
- ✅ Redis cachea datos internos

**Rutas afectadas**:
- `/` (landing)
- `/*/products`
- `/*/subscriptions`
- `/*/terms`
- `/*/privacy`

**Beneficios**:
- Reduce carga en servidor
- Mejora tiempo de respuesta
- Contenido se actualiza cada minuto

### 3. Assets Estáticos

**Ejemplos**: JavaScript, CSS, Imágenes, Fuentes

**Headers HTTP**:
```
Cache-Control: public, max-age=31536000, immutable
```

**Comportamiento**:
- ✅ Cloudflare cachea por 1 año
- ✅ Navegador cachea por 1 año
- ✅ Archivos tienen hash único (cache busting automático)

**Rutas afectadas**:
- `/_next/static/*` (JS, CSS de Next.js)
- `/static/*` (archivos públicos)
- `*.jpg`, `*.png`, `*.svg`, `*.woff`, etc.

### 4. APIs

#### APIs Privadas
**Ejemplos**: `/api/profile/*`, `/api/wallet/*`

```
Cache-Control: private, no-cache, no-store, must-revalidate
```

#### APIs Públicas
**Ejemplos**: `/api/settings/free-product-value`

```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

---

## Configuración de Redis

### ¿Qué es Upstash Redis?

Upstash Redis es una base de datos Redis serverless ideal para:
- Caché de datos
- Sesiones de usuario
- Rate limiting
- Contadores en tiempo real

### Configuración Inicial

#### 1. Crear Cuenta en Upstash

1. Ve a [https://console.upstash.com/](https://console.upstash.com/)
2. Regístrate con GitHub, Google o email
3. Verifica tu cuenta

#### 2. Crear Base de Datos Redis

1. Click en **"Create Database"**
2. Configura:
   - **Name**: `purvita-cache`
   - **Type**: Regional (dev) o Global (prod)
   - **Region**: Más cercana a tus usuarios
   - **Eviction**: `allkeys-lru`
3. Click en **"Create"**

#### 3. Obtener Credenciales

1. Ve a **"Details"** de tu base de datos
2. Busca **"REST API"**
3. Copia:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

#### 4. Configurar Variables de Entorno

**Producción (Vercel)**:
```bash
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

**Desarrollo (Opcional)**:
```bash
# En .env.local
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
NODE_ENV=production  # Forzar modo producción (no recomendado)
```

### Uso en el Código

#### Importar Cliente Redis

```typescript
import { redisCache, CacheKeys } from '@/lib/redis';
```

#### Ejemplos de Uso

**1. Caché Simple (Get/Set)**
```typescript
// Guardar en caché
await redisCache.set('user:123', { name: 'Juan', email: 'juan@example.com' }, 3600);

// Obtener de caché
const user = await redisCache.get('user:123');
```

**2. Patrón Get-or-Set (Recomendado)**
```typescript
const settings = await redisCache.getOrSet(
  CacheKeys.appSettings(),
  async () => await fetchSettingsFromDatabase(),
  300 // TTL: 5 minutos
);
```

**3. Caché de Configuración**
```typescript
import { getCachedAppSettings } from '@/lib/helpers/cached-settings-helper';

const settings = await getCachedAppSettings();
```

**4. Invalidar Caché**
```typescript
// Eliminar clave específica
await redisCache.delete(CacheKeys.userProfile('123'));

// Eliminar múltiples claves con patrón
await redisCache.deletePattern('user:*');
```

**5. Rate Limiting**
```typescript
import { rateLimit, RateLimitPresets } from '@/lib/utils/rate-limit';

const result = await rateLimit(userId, RateLimitPresets.standard);

if (!result.success) {
  return new Response('Too many requests', { status: 429 });
}
```

### Claves de Caché Predefinidas

```typescript
CacheKeys.appSettings()                    // 'app:settings'
CacheKeys.phaseLevels()                    // 'app:phase-levels'
CacheKeys.user(userId)                     // 'user:123'
CacheKeys.userProfile(userId)              // 'user:123:profile'
CacheKeys.userWallet(userId)               // 'user:123:wallet'
CacheKeys.product(productId)               // 'product:abc'
CacheKeys.products()                       // 'products:all'
CacheKeys.translation(locale, namespace)   // 'i18n:es:common'
CacheKeys.rateLimit(identifier)            // 'ratelimit:user-123'
```

---

## Configuración de Cloudflare

### Configuración General

1. Ve a tu dominio en Cloudflare Dashboard
2. **Caching** → **Configuration**
3. Configura:
   - **Caching Level**: `Standard` (respeta headers)
   - **Browser Cache TTL**: `Respect Existing Headers`
   - **Always Online**: `On` (opcional)

### Page Rules

Ve a **Rules** → **Page Rules** y crea:

#### 1. Bypass Cache para Páginas Autenticadas
```
URL: *purvitahealth.com/*/dashboard*
Setting: Cache Level = Bypass

URL: *purvitahealth.com/*/profile*
Setting: Cache Level = Bypass

URL: *purvitahealth.com/admin*
Setting: Cache Level = Bypass
```

#### 2. Cache Agresivo para Assets
```
URL: *purvitahealth.com/_next/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
```

### Cache Rules (Alternativa Moderna)

**Regla 1: Bypass Dynamic Content**
```
When incoming requests match:
  - URI Path starts with /en/dashboard OR
  - URI Path starts with /es/dashboard OR
  - URI Path starts with /admin

Then:
  - Cache eligibility: Bypass cache
```

**Regla 2: Cache Static Assets**
```
When incoming requests match:
  - URI Path starts with /_next/static/ OR
  - File extension is one of: jpg, png, svg, woff, css, js

Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 1 year
```

---

## Comportamiento Dev vs Producción

### En Desarrollo (`npm run dev`)

| Aspecto | Estado |
|---------|--------|
| **Redis** | ❌ Deshabilitado |
| **Caché** | ✅ Memoria (fallback) |
| **Rate Limiting** | ✅ Memoria |
| **Variables Requeridas** | ❌ No necesarias |

**Ventajas**:
- No necesitas cuenta de Upstash
- No gastas comandos del plan gratuito
- Desarrollo más rápido sin conexiones externas
- Funciona offline

**Logs**:
```
[Redis] Redis is disabled in development mode. Using in-memory fallback.
```

### En Producción (`npm run build` + `npm start`)

| Aspecto | Estado |
|---------|--------|
| **Redis** | ✅ Habilitado |
| **Caché** | ✅ Redis (Upstash) |
| **Rate Limiting** | ✅ Redis distribuido |
| **Variables Requeridas** | ✅ Sí |

**Ventajas**:
- Caché compartido entre instancias serverless
- Rate limiting consistente
- Mejor rendimiento con TTL automático
- Persistencia entre despliegues

**Logs**:
```
[Redis] Successfully connected to Upstash Redis
```

---

## Verificación y Testing

### Verificar Headers en Producción

**Opción A - Script PowerShell**:
```powershell
.\scripts\test-cache-headers.ps1 purvitahealth.com
```

**Opción B - Script Bash**:
```bash
./scripts/test-cache-headers.sh purvitahealth.com
```

**Opción C - Manual con curl**:
```bash
# Página dinámica (NO debe cachear)
curl -I https://purvitahealth.com/en/dashboard

# Deberías ver:
# Cache-Control: private, no-cache, no-store, must-revalidate
# CF-Cache-Status: DYNAMIC o BYPASS

# Página pública (cache corto)
curl -I https://purvitahealth.com/en

# Deberías ver:
# Cache-Control: public, s-maxage=60, stale-while-revalidate=120
# CF-Cache-Status: HIT (después de primera visita)
```

### Probar Conexión a Redis

```bash
npm run test:redis
```

Este script verifica:
- ✅ Variables de entorno configuradas
- ✅ Conexión a Redis funcional
- ✅ Operaciones básicas (get/set/delete)

---

## Ejemplos de Headers

### Páginas Dinámicas (Dashboard)

**Primera Petición**:
```http
HTTP/2 200
cache-control: private, no-cache, no-store, must-revalidate
cf-cache-status: DYNAMIC
x-frame-options: DENY
```

### Páginas Públicas (Landing)

**Primera Petición**:
```http
HTTP/2 200
cache-control: public, s-maxage=60, stale-while-revalidate=120
cf-cache-status: MISS
age: 0
```

**Segunda Petición (< 60s)**:
```http
HTTP/2 200
cache-control: public, s-maxage=60, stale-while-revalidate=120
cf-cache-status: HIT
age: 15
```

### Assets Estáticos

```http
HTTP/2 200
content-type: application/javascript
cache-control: public, max-age=31536000, immutable
cf-cache-status: HIT
age: 3600
```

### Interpretación de CF-Cache-Status

| Valor | Significado | ¿Es Correcto? |
|-------|-------------|---------------|
| `HIT` | Servido desde caché de Cloudflare | ✅ Para assets y páginas públicas<br>❌ Para páginas autenticadas |
| `MISS` | No estaba en caché, obtenido del origen | ✅ Primera petición |
| `DYNAMIC` | Contenido dinámico, no cacheado | ✅ Para páginas autenticadas |
| `BYPASS` | Cache bypassed por Page Rule | ✅ Para páginas autenticadas |
| `EXPIRED` | Caché expirado, revalidando | ✅ Normal |
| `STALE` | Sirviendo caché viejo mientras revalida | ✅ Normal con stale-while-revalidate |

---

## Troubleshooting

### Problema: Usuarios ven datos de otros usuarios

**Síntoma**: Usuario A ve información de Usuario B

**Causa**: Cloudflare está cacheando páginas autenticadas

**Solución**:
1. Verifica headers con `curl -I`
2. Debe mostrar `Cache-Control: private, no-cache`
3. Purga caché de Cloudflare inmediatamente
4. Verifica Page Rules en Cloudflare

### Problema: Redis no se conecta

**Síntoma**: Logs muestran errores de conexión

**Solución**:
1. Verifica variables de entorno
2. Asegúrate de que la URL incluya `https://`
3. Verifica que el token sea correcto
4. Ejecuta `npm run test:redis`

### Problema: Cambios no se reflejan

**Síntoma**: Actualicé contenido pero no se ve

**Causa**: Caché de Cloudflare o navegador

**Solución**:
1. **Desarrollo**: Activa Development Mode en Cloudflare
2. **Producción**: Purga caché específico
3. **Assets**: Next.js usa hashes, no debería pasar

### Problema: Sitio muy lento

**Síntoma**: Tiempos de respuesta altos

**Causa**: Cloudflare no está cacheando nada

**Solución**:
1. Verifica que Caching Level esté en "Standard"
2. Verifica Page Rules para assets estáticos
3. Revisa Analytics en Cloudflare

---

## Métricas Esperadas

### Cache Hit Rates

- **Assets estáticos**: 90-95% (muy alto)
- **Páginas públicas**: 40-60% (medio)
- **Páginas autenticadas**: 0% (siempre bypass, correcto)

### Reducción de Carga

- **Consultas a DB**: -70% (gracias a Redis)
- **Ancho de banda**: -80% (gracias a Cloudflare)
- **Tiempo de respuesta**: -50% (promedio)

---

## Mejores Prácticas

1. **Nunca cachear contenido autenticado** en Cloudflare
2. **Usar TTL cortos** para contenido que cambia frecuentemente
3. **Usar TTL largos** para assets estáticos
4. **Implementar cache busting** (Next.js lo hace automáticamente)
5. **Monitorear cache hit rates** regularmente
6. **Purgar caché** después de deploys importantes
7. **Usar stale-while-revalidate** para mejor UX

---

## Archivos Clave

### Configuración
- `next.config.ts` - Headers de caché para Next.js
- `src/middleware.ts` - Aplicación de headers según ruta
- `src/lib/redis.ts` - Cliente Redis y utilidades
- `src/lib/utils/rate-limit.ts` - Sistema de rate limiting

### Helpers
- `src/lib/helpers/cached-settings-helper.ts` - Caché de configuración
- `src/lib/helpers/affiliate-context-helper.ts` - Contexto de afiliado

### Scripts
- `scripts/test-cache-headers.sh` - Testing de headers (Bash)
- `scripts/test-cache-headers.ps1` - Testing de headers (PowerShell)
- `scripts/test-redis.ts` - Testing de conexión Redis

---

## Recursos Adicionales

- [Cloudflare Cache Documentation](https://developers.cloudflare.com/cache/)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Next.js Caching Documentation](https://nextjs.org/docs/app/building-your-application/caching)
- [HTTP Cache-Control Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)

---

**Última actualización**: 2025-10-24
**Versión**: 2.0
**Estado**: ✅ Implementado y Documentado
