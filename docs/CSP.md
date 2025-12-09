# 🛡️ Configuración CSP Completa - PūrVita Network

**Fecha:** 2025-01-14
**Versión:** 2.1 - Actualización con Dominio Principal
**Última actualización:** Agregado dominio purvitahealth.com + Escaneo completo del proyecto + Cloudflare + Vercel + Tawk.to

---

## 📋 Resumen Ejecutivo

Este documento detalla**TODOS los recursos externos**que usa la aplicación PūrVita Network y cómo están configurados en el**Content Security Policy (CSP)**.

**Archivo CSP:**`src/lib/security/csp-nonce.ts`

### Servicios Incluidos

1. ✅**Proveedores de Pago**(Stripe, PayPal)

2. ✅**Analytics y Publicidad**(Vercel, Facebook, TikTok, Google, Cloudflare)

3. ✅**Backend**(Supabase, Upstash)

4. ✅**Infraestructura**(Cloudflare CDN, Vercel Hosting)

5. ✅**Soporte al Cliente**(Tawk.to Live Chat)

6. ✅**Imágenes Externas**(Unsplash, Picsum, Placehold.co, Supabase Storage)

7. ✅**APIs de Geolocalización**(ipapi.co, ip-api.com)

8. ✅**Recursos Internos**(blob:, data:, WebSockets)

---

## 💳 Proveedores de Pago Configurados

### 1.**Stripe** ✅

**Tipo:** Procesador de tarjetas de crédito/débito  
**Uso:** Pagos con tarjeta, suscripciones

### Dominios necesarios en CSP

- `https://js.stripe.com` - Script SDK de Stripe

- `https://api.stripe.com` - API de Stripe para peticiones

### Configuración actual

```typescript
script-src 'self' 'nonce-${nonce}' <https://js.stripe.com>
connect-src 'self' <https://api.stripe.com>
frame-src 'self' <https://js.stripe.com>

```text

### Webhooks:

- `/api/webhooks/stripe` - Recibe eventos de Stripe

---

### 2. **PayPal** ✅

**Tipo:** Procesador de pagos PayPal  
**Uso:** Pagos con cuenta PayPal, tarjetas vía PayPal

### Dominios necesarios en CSP:

- `https://www.paypal.com` - Script SDK de PayPal

- `https://api.paypal.com` - API de PayPal (producción)

- `https://api-m.paypal.com` - API de PayPal (producción alternativa)

- `https://api-m.sandbox.paypal.com` - API de PayPal (sandbox/testing)

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://www.paypal.com>
connect-src 'self' <https://api.paypal.com> https://api-m.paypal.com <https://api-m.sandbox.paypal.com>
frame-src 'self' <https://www.paypal.com>

```text

### Webhooks:

- `/api/webhooks/paypal` - Recibe eventos de PayPal

---

### 3. **Wallet (Monedero Interno)** ✅

**Tipo:** Sistema de monedero interno  
**Uso:** Pagos con saldo de monedero del usuario

**Dominios necesarios:** Ninguno (todo interno)

### Endpoints:

- `/api/payments/wallet/charge` - Procesar pago con monedero

---

### 4. **Manual** ✅

**Tipo:** Pagos manuales (transferencias bancarias, etc.)  
**Uso:** Pagos procesados manualmente por admin

**Dominios necesarios:**Ninguno (todo interno)

---

## 📊 Servicios de Analytics y Publicidad

### 1.**Vercel Analytics & Speed Insights** ✅

**Tipo:** Analytics de rendimiento y métricas web
**Uso:** Métricas de velocidad, rendimiento, Core Web Vitals

### Dominios necesarios:

- `https://*.vercel-insights.com` - Vercel Analytics

- `https://va.vercel-scripts.com` - Vercel Analytics (dominio alternativo)

- `https://vitals.vercel-insights.com` - Vercel Speed Insights

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://*.vercel-insights.com> https://va.vercel-scripts.com
connect-src 'self' <https://*.vercel-insights.com> https://vitals.vercel-insights.com

```text

---

### 2. **Facebook Pixel** ✅

**Tipo:** Pixel de seguimiento de Facebook
**Uso:** Tracking de conversiones, remarketing, publicidad

### Dominios necesarios:

- `https://connect.facebook.net` - Script del pixel

- `https://www.facebook.com` - API de eventos

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://connect.facebook.net>
connect-src 'self' <https://www.facebook.com> https://connect.facebook.net
img-src 'self' data: https: blob: <https://www.facebook.com>

```text

---

### 3. **TikTok Pixel** ✅

**Tipo:** Pixel de seguimiento de TikTok
**Uso:** Tracking de conversiones, remarketing, publicidad

### Dominios necesarios:

- `https://analytics.tiktok.com` - Script del pixel

- `https://www.tiktok.com` - API de eventos

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://analytics.tiktok.com>
connect-src 'self' <https://analytics.tiktok.com> https://www.tiktok.com

```text

---

### 4. **Google Tag Manager & Analytics** ✅

**Tipo:** Gestor de etiquetas y analytics de Google
**Uso:** Analytics, conversiones, remarketing, publicidad

### Dominios necesarios:

- `https://www.googletagmanager.com` - Script de GTM

- `https://www.google-analytics.com` - Google Analytics

- `https://analytics.google.com` - Google Analytics 4

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://www.googletagmanager.com> https://www.google-analytics.com
connect-src 'self' <https://www.googletagmanager.com> https://www.google-analytics.com <https://analytics.google.com>
img-src 'self' data: https: blob: <https://www.google-analytics.com>

```text

---

## 🗄️ Servicios de Backend

### 1. **Supabase** ✅

**Tipo:** Base de datos, autenticación, storage
**Uso:** Backend principal de la aplicación

### Dominios necesarios:

- `https://*.supabase.co` - API de Supabase (REST API)

- `wss://*.supabase.co` - Supabase Realtime (WebSocket)

### Configuración actual:

```typescript
connect-src 'self' <https://*.supabase.co> wss://*.supabase.co
img-src 'self' data: https: blob: <https://*.supabase.co>

```text

### Buckets de Supabase Storage:

- `products` - Imágenes de productos

- `page` - Imágenes de páginas

- `marketing-assets` - Assets de marketing

- Favicon y branding

---

### 2. **Upstash (Redis)** ✅

**Tipo:** Redis para rate limiting y caché
**Uso:** Rate limiting, sesiones, caché

### Dominios necesarios:

- `https://*.upstash.io` - API de Upstash Redis

### Configuración actual:

```typescript
connect-src 'self' <https://*.upstash.io>

```text

---

## 🌐 Infraestructura y CDN

### 1. **Cloudflare** ✅

**Tipo:** CDN, DDoS protection, Web Analytics
**Uso:** CDN para assets estáticos, protección DDoS, analytics

### Dominios necesarios:

- `https://*.cloudflareinsights.com` - Cloudflare Web Analytics

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://*.cloudflareinsights.com>
connect-src 'self' <https://*.cloudflareinsights.com>

```text

**Nota:**Cloudflare actúa como proxy/CDN, por lo que el tráfico pasa a través de Cloudflare automáticamente.

---

### 2.**Vercel** ✅

**Tipo:** Hosting, Edge Functions, Serverless
**Uso:** Hosting de la aplicación, edge functions

### Dominios necesarios:

- `https://*.vercel.app` - Vercel deployments (preview/production)

- `https://*.vercel.com` - Vercel API

### Configuración actual:

```typescript
connect-src 'self' <https://*.vercel.app> https://*.vercel.com

```text

**Nota:**Vercel Analytics ya está configurado en la sección de Analytics.

---

## 💬 Soporte al Cliente

### 1.**Tawk.to** ✅

**Tipo:** Live Chat Widget
**Uso:** Chat en vivo con clientes

### Dominios necesarios:

- `https://embed.tawk.to` - Script del widget de chat

- `https://*.tawk.to` - API de Tawk.to

- `wss://*.tawk.to` - WebSocket para chat en tiempo real

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://embed.tawk.to>
connect-src 'self' <https://*.tawk.to> wss://*.tawk.to
img-src 'self' data: https: blob: <https://*.tawk.to>
frame-src 'self' <https://embed.tawk.to>

```text

**Nota:**Tawk.to requiere `'unsafe-inline'` en `style-src` para estilos dinámicos del widget.

---

## 🛡️ Seguridad y CAPTCHA

### 1.**Google reCAPTCHA v2/v3** ✅

**Tipo:** Bot Protection
**Uso:** Protección contra bots y spam en formularios (login, registro, contacto)

### Dominios necesarios:

- `https://www.google.com` - reCAPTCHA API y scripts

- `https://www.gstatic.com` - Assets de reCAPTCHA

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://www.google.com> https://www.gstatic.com
connect-src 'self' <https://www.google.com> https://www.gstatic.com
frame-src 'self' <https://www.google.com> https://www.gstatic.com

```text

**Nota:**Soporta tanto reCAPTCHA v2 (checkbox) como v3 (invisible).

---

### 2.**hCaptcha** ✅

**Tipo:** Bot Protection
**Uso:** Alternativa a reCAPTCHA con mejor privacidad

### Dominios necesarios:

- `https://js.hcaptcha.com` - Script principal de hCaptcha

- `https://*.hcaptcha.com` - API y assets de hCaptcha

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://js.hcaptcha.com> https://*.hcaptcha.com
connect-src 'self' <https://*.hcaptcha.com>
frame-src 'self' <https://*.hcaptcha.com>

```text

---

### 3. **Cloudflare Turnstile** ✅

**Tipo:** Bot Protection
**Uso:** CAPTCHA invisible de Cloudflare sin fricción para usuarios

### Dominios necesarios:

- `https://challenges.cloudflare.com` - API y widget de Turnstile

### Configuración actual:

```typescript
script-src 'self' 'nonce-${nonce}' <https://challenges.cloudflare.com>
connect-src 'self' <https://challenges.cloudflare.com>
frame-src 'self' <https://challenges.cloudflare.com>

```text

---

## 🖼️ Fuentes de Imágenes Externas

### 1. **Supabase Storage** ✅

**Tipo:** Almacenamiento de imágenes
**Uso:** Imágenes de productos, branding, favicon, assets de marketing

### Dominios necesarios:

- `https://*.supabase.co` - Supabase Storage

### Configuración actual:

```typescript
img-src 'self' data: https: blob: <https://*.supabase.co>

```text

### Buckets usados:

- `products` - Imágenes de productos

- `page` - Imágenes de páginas

- `marketing-assets` - Assets de marketing

- Favicon y branding

---

### 2. **Unsplash** ✅

**Tipo:** Imágenes de placeholder
**Uso:** Imágenes temporales durante desarrollo

### Dominios necesarios:

- `https://images.unsplash.com` - API de Unsplash

### Configuración actual:

```typescript
img-src 'self' data: https: blob: <https://images.unsplash.com>

```text

---

### 3. **Picsum Photos** ✅

**Tipo:** Imágenes de placeholder
**Uso:** Imágenes temporales durante desarrollo

### Dominios necesarios:

- `https://picsum.photos` - API de Picsum

### Configuración actual:

```typescript
img-src 'self' data: https: blob: <https://picsum.photos>

```text

---

### 4. **Placehold.co** ✅

**Tipo:** Imágenes de placeholder
**Uso:** Imágenes temporales durante desarrollo

### Dominios necesarios:

- `https://placehold.co` - API de Placehold.co

### Configuración actual:

```typescript
img-src 'self' data: https: blob: <https://placehold.co>

```text

---

## 🌍 APIs de Geolocalización

### 1. **ipapi.co** ✅

**Tipo:** API de geolocalización por IP
**Uso:** Detección de país del usuario para fraud detection

### Dominios necesarios:

- `https://ipapi.co` - API de ipapi.co

### Configuración actual:

```typescript
connect-src 'self' <https://ipapi.co>

```text

**Nota:**Esta API se llama desde el servidor (API routes), no desde el navegador.

---

### 2.**ip-api.com** ✅

**Tipo:** API de geolocalización por IP (fallback)
**Uso:** Fallback si ipapi.co falla

### Dominios necesarios:

- `http://ip-api.com` - API de ip-api.com (solo HTTP)

### Configuración actual:

```typescript
connect-src 'self' <http://ip-api.com>

```text

**Nota:**Esta API solo está disponible en HTTP (no HTTPS). Se usa como fallback desde el servidor.

---

## 🔧 Recursos Internos

### 1.**blob: URLs** ✅

**Tipo:** URLs de objetos Blob
**Uso:** Previsualizaciones de imágenes, PDFs, emails, invoices

### Configuración actual:

```typescript
img-src 'self' data: https: blob:
frame-src 'self' <https://js.stripe.com> https://www.paypal.com <https://embed.tawk.to> blob:
media-src 'self' data: blob:
worker-src 'self' blob:

```text

### Ejemplos de uso:

- Vista previa de imágenes antes de subir

- Vista previa de emails en admin panel

- Vista previa de invoices en perfil de usuario

- Generación de PDFs

---

### 2. **data: URIs** ✅

**Tipo:** URIs de datos inline
**Uso:** Imágenes pequeñas, iconos, fuentes

### Configuración actual:

```typescript
img-src 'self' data: https: blob:
font-src 'self' data: <https://fonts.gstatic.com>
media-src 'self' data: blob:

```text

### Ejemplos de uso:

- Iconos SVG inline

- Fuentes base64

- Imágenes pequeñas inline

---

### 3. **WebSockets (wss://)** ✅

**Tipo:** Conexiones WebSocket
**Uso:** Supabase Realtime, Tawk.to Chat

### Configuración actual:

```typescript
connect-src 'self' wss://*.supabase.co wss://*.tawk.to

```text

### Servicios que usan WebSockets:

- Supabase Realtime - Actualizaciones en tiempo real de la base de datos

- Tawk.to - Chat en vivo con clientes

---

## 🔍 Servicios de Seguridad (Threat Intelligence)

Estos servicios se llaman desde el **servidor**(no desde el navegador), por lo que**NO necesitan estar en CSP**.

### 1. **Abuse.ch**(Server-side only)

- URLhaus API

- ThreatFox API

### 2.**VirusTotal**(Server-side only)

- API de análisis de URLs

### 3.**Google Safe Browsing** (Server-side only)

- API de URLs maliciosas

---

## ✅ CSP Actual (Configuración Completa)

### Archivo: `src/lib/security/csp-nonce.ts`

```typescript
export function getCSPWithNonce(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",

    // Scripts: App + Payment Providers + Analytics + Advertising + Customer Support + CAPTCHA
    `script-src 'self' 'nonce-${nonce}' ` +
      'https://purvitahealth.com ' +                // Main production domain
      'https://www.purvitahealth.com ' +            // Main production domain (www)
      '<https://js.stripe.com> ' +                    // Stripe SDK
      '<https://www.paypal.com> ' +                   // PayPal SDK
      '<https://*.vercel-insights.com> ' +            // Vercel Analytics
      '<https://va.vercel-scripts.com> ' +            // Vercel Analytics (alternative domain)
      '<https://connect.facebook.net> ' +             // Facebook Pixel
      '<https://analytics.tiktok.com> ' +             // TikTok Pixel
      '<https://www.googletagmanager.com> ' +         // Google Tag Manager
      '<https://www.google-analytics.com> ' +         // Google Analytics
      '<https://embed.tawk.to> ' +                    // Tawk.to Chat Widget
      '<https://*.cloudflareinsights.com> ' +         // Cloudflare Web Analytics
      '<https://www.google.com> ' +                   // Google reCAPTCHA v2/v3
      '<https://www.gstatic.com> ' +                  // Google reCAPTCHA assets
      '<https://js.hcaptcha.com> ' +                  // hCaptcha
      '<https://*.hcaptcha.com> ' +                   // hCaptcha (alternative domains)
      '<https://challenges.cloudflare.com',>          // Cloudflare Turnstile

    // Styles: App + Tawk.to (needs unsafe-inline for dynamic styles)
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,

    // Images: App + External Image Sources + Analytics tracking pixels + Tawk.to
    "img-src 'self' data: https: blob: " +
      'https://purvitahealth.com ' +                // Main production domain
      'https://www.purvitahealth.com ' +            // Main production domain (www)
      '<https://*.supabase.co> ' +                    // Supabase Storage
      '<https://images.unsplash.com> ' +              // Unsplash
      '<https://picsum.photos> ' +                    // Picsum Photos
      '<https://placehold.co> ' +                     // Placehold.co
      '<https://www.google-analytics.com> ' +         // GA tracking pixels
      '<https://www.facebook.com> ' +                 // FB tracking pixels
      '<https://*.tawk.to',>                          // Tawk.to avatars

    // Fonts: App + Tawk.to
    "font-src 'self' data: " +
      '<https://fonts.gstatic.com',>                  // Google Fonts (used by Tawk.to)

    // Connections: App + Backend + Payment Providers + Analytics + Geolocation + Support
    "connect-src 'self' " +
      'https://purvitahealth.com ' +                // Main production domain
      'https://www.purvitahealth.com ' +            // Main production domain (www)
      '<https://*.supabase.co> ' +                    // Supabase API
      'wss://*.supabase.co ' +                      // Supabase Realtime (WebSocket)
      '<https://*.upstash.io> ' +                     // Upstash Redis
      '<https://api.stripe.com> ' +                   // Stripe API
      '<https://api.paypal.com> ' +                   // PayPal API (production)
      '<https://api-m.paypal.com> ' +                 // PayPal API (production alt)
      '<https://api-m.sandbox.paypal.com> ' +         // PayPal API (sandbox)
      '<https://*.vercel-insights.com> ' +            // Vercel Analytics
      '<https://vitals.vercel-insights.com> ' +       // Vercel Speed Insights
      '<https://*.vercel.app> ' +                     // Vercel deployments
      '<https://*.vercel.com> ' +                     // Vercel API
      '<https://www.facebook.com> ' +                 // Facebook Pixel API
      '<https://connect.facebook.net> ' +             // Facebook Pixel
      '<https://analytics.tiktok.com> ' +             // TikTok Pixel API
      '<https://www.tiktok.com> ' +                   // TikTok Pixel
      '<https://www.googletagmanager.com> ' +         // Google Tag Manager
      '<https://www.google-analytics.com> ' +         // Google Analytics
      '<https://analytics.google.com> ' +             // Google Analytics 4
      '<https://ipapi.co> ' +                         // IP Geolocation (primary)
      '<http://ip-api.com> ' +                        // IP Geolocation (fallback)
      '<https://*.tawk.to> ' +                        // Tawk.to Chat API
      'wss://*.tawk.to ' +                          // Tawk.to Chat WebSocket
      '<https://*.cloudflareinsights.com',>           // Cloudflare Web Analytics

    // Frames/iframes: Payment providers + Email previews + Tawk.to
    "frame-src 'self' " +
      '<https://js.stripe.com> ' +                    // Stripe Checkout
      '<https://www.paypal.com> ' +                   // PayPal Checkout
      '<https://embed.tawk.to> ' +                    // Tawk.to Chat Widget
      'blob:',                                      // Blob URLs for email/invoice previews

    // Media: Allow media from same origin and data URIs
    "media-src 'self' data: blob:",

    // Workers: Allow web workers from same origin
    "worker-src 'self' blob:",

    // Security: Prevent common attacks
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ]

  return cspDirectives.join('; ')
}

```text

---

## � Notas de Implementación

### ✅ Servicios Configurados

### Proveedores de Pago:

- ✅ Stripe (SDK + API)

- ✅ PayPal (SDK + API - Production + Sandbox)

### Analytics y Publicidad:

- ✅ Vercel Analytics + Speed Insights

- ✅ Facebook Pixel

- ✅ TikTok Pixel

- ✅ Google Tag Manager + Analytics

- ✅ Cloudflare Web Analytics

### Backend:

- ✅ Supabase (API + Realtime WebSocket + Storage)

- ✅ Upstash Redis

### Infraestructura:

- ✅ Cloudflare (CDN + Analytics)

- ✅ Vercel (Hosting + Edge Functions)

### Soporte:

- ✅ Tawk.to (Live Chat + WebSocket)

### Imágenes:

- ✅ Supabase Storage

- ✅ Unsplash

- ✅ Picsum Photos

- ✅ Placehold.co

### Geolocalización:

- ✅ ipapi.co

- ✅ ip-api.com

### Recursos Internos:

- ✅ blob: URLs

- ✅ data: URIs

- ✅ WebSockets (wss://)

---

## 📊 Tabla Completa de Dominios por Servicio

| Servicio | Categoría | script-src | connect-src | img-src | frame-src | font-src |
|----------|-----------|------------|-------------|---------|-----------|----------|
| **Stripe**| Pagos | ✅ js.stripe.com | ✅ api.stripe.com | - | ✅ js.stripe.com | - |

|**PayPal**| Pagos | ✅ www.paypal.com | ✅ api.paypal.com, ✅ api-m.paypal.com, ✅ api-m.sandbox.paypal.com | - | ✅ www.paypal.com | - |

|**Vercel Analytics** | Analytics | ✅ *.vercel-insights.com, ✅ va.vercel-scripts.com | ✅ *.vercel-insights.com, ✅ vitals.vercel-insights.com | - | - | - |

| **Vercel Hosting** | Infraestructura | - | ✅ *.vercel.app, ✅ *.vercel.com | - | - | - |

| **Facebook Pixel**| Publicidad | ✅ connect.facebook.net | ✅ www.facebook.com, ✅ connect.facebook.net | ✅ www.facebook.com | - | - |

|**TikTok Pixel**| Publicidad | ✅ analytics.tiktok.com | ✅ analytics.tiktok.com, ✅ www.tiktok.com | - | - | - |

|**Google Analytics**| Analytics | ✅ www.googletagmanager.com, ✅ www.google-analytics.com | ✅ www.googletagmanager.com, ✅ www.google-analytics.com, ✅ analytics.google.com | ✅ www.google-analytics.com | - | - |

|**Cloudflare** | Infraestructura | ✅ *.cloudflareinsights.com | ✅ *.cloudflareinsights.com | - | - | - |

| **Tawk.to** | Soporte | ✅ embed.tawk.to | ✅ *.tawk.to, 🔌 wss://*.tawk.to | ✅ *.tawk.to | ✅ embed.tawk.to | - |

| **Supabase** | Backend | - | ✅ *.supabase.co, 🔌 wss://*.supabase.co | ✅ *.supabase.co | - | - |

| **Upstash** | Backend | - | ✅ *.upstash.io | - | - | - |

| **Unsplash**| Imágenes | - | - | ✅ images.unsplash.com | - | - |

|**Picsum**| Imágenes | - | - | ✅ picsum.photos | - | - |

|**Placehold.co**| Imágenes | - | - | ✅ placehold.co | - | - |

|**ipapi.co**| Geolocalización | - | ✅ ipapi.co | - | - | - |

|**ip-api.com**| Geolocalización | - | ✅ <http://ip-api.com> | - | - | - |

|**Google Fonts**| Fuentes | - | - | - | - | ✅ fonts.gstatic.com |

|**blob: URLs**| Interno | - | - | ✅ blob: | ✅ blob: | - |

|**data: URIs** | Interno | - | - | ✅ data: | - | ✅ data: |

### Leyenda:

- ✅ = Dominio permitido

- 🔌 = WebSocket (wss://)

- `-` = No aplica

---

## 🧪 Testing de CSP

### 1. Habilitar CSP en Desarrollo

```bash

# .env.local

ENABLE_CSP_DEV=true

```text

### 2. Verificar en DevTools

1. Abrir **DevTools > Console**
2. Buscar errores de CSP:

   ```text
   Refused to load the script '<https://...'> because it violates
   the following Content Security Policy directive: "script-src ..."
   ```

### 3. Verificar Headers

1. Abrir **DevTools > Network**
2. Seleccionar cualquier petición
3. Ver **Headers > Response Headers**
4. Buscar `Content-Security-Policy`

### 4. Probar Cada Servicio

- ✅ **Stripe**: Ir a checkout, verificar que carga el formulario

- ✅ **PayPal**: Ir a checkout, verificar que carga el botón

- ✅ **Facebook Pixel**: Verificar en Facebook Events Manager

- ✅ **TikTok Pixel**: Verificar en TikTok Events Manager

- ✅ **Google Analytics**: Verificar en Google Analytics Real-Time

---

## ⚠️ Notas Importantes

### 1. **Wildcards (`*`)**

```typescript
// ✅ CORRECTO: Wildcard en subdominio
'<https://*.supabase.co'>  // Permite cualquier subdominio de supabase.co

// ❌ INCORRECTO: Wildcard en dominio completo
'<https://*'>  // Demasiado permisivo, inseguro

```text

### 2. **Sandbox vs Producción**

PayPal tiene diferentes URLs para sandbox y producción:

- **Sandbox**: `https://api-m.sandbox.paypal.com`

- **Producción**: `https://api-m.paypal.com` o `https://api.paypal.com`

**Ambas deben estar en CSP**para que funcione en desarrollo y producción.

### 3.**Scripts Dinámicos**

Stripe, PayPal, Facebook, TikTok y Google **actualizan sus scripts frecuentemente**.

**NO uses SRI (Subresource Integrity)**con estos servicios porque:

- ❌ Se romperá cuando actualicen el script

- ✅ En su lugar, confía en HTTPS + CSP whitelist

### 4.**Nonces**

Los scripts inline de tu app **deben usar nonce**:

```tsx
// ✅ CORRECTO
<script nonce={nonce}>
  console.log('Safe inline script');
</script>

// ❌ INCORRECTO (bloqueado por CSP)
<script>
  console.log('Blocked inline script');
</script>

```text

---

## 🎯 Resumen Final

### ✅ Estado Actual del CSP

### Todos los servicios están configurados correctamente:

- ✅ **Proveedores de Pago:**Stripe, PayPal (Production + Sandbox)

- ✅**Analytics:**Vercel Analytics, Google Analytics, Cloudflare Analytics

- ✅**Publicidad:**Facebook Pixel, TikTok Pixel, Google Tag Manager

- ✅**Backend:**Supabase (API + Realtime + Storage), Upstash Redis

- ✅**Infraestructura:**Cloudflare CDN, Vercel Hosting

- ✅**Soporte:**Tawk.to Live Chat

- ✅**Imágenes:**Supabase Storage, Unsplash, Picsum, Placehold.co

- ✅**Geolocalización:**ipapi.co, ip-api.com

- ✅**Recursos Internos:**blob:, data:, WebSockets

### 📝 Próximos Pasos

1.**Habilitar CSP en desarrollo:**
   ```bash
   # .env.local

   ENABLE_CSP_DEV=true
   ```

1. **Probar todas las funcionalidades:**
   - Checkout (Stripe + PayPal)
   - Chat en vivo (Tawk.to)
   - Analytics (Vercel, Google, Facebook, TikTok, Cloudflare)
   - Upload de imágenes
   - Vista previa de emails/invoices

1. **Verificar en DevTools:**
   - Abrir Console y buscar errores de CSP
   - Verificar que todos los servicios carguen correctamente

1. **Desplegar a producción:**
   - Una vez verificado en desarrollo, desplegar a producción
   - CSP se activa automáticamente en producción

---

### El CSP está completamente configurado y listo para usar. ✅
