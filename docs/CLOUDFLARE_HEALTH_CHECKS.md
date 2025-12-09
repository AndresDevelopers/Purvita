# 🏥 Configuración de Cloudflare Health Checks por API

**Fecha:** 2025-01-13
**Versión:** 1.0
**Descripción:** Guía completa para configurar Cloudflare Health Checks usando la API de PūrVita

---

## 📋 Resumen

Este documento explica cómo configurar **Cloudflare Health Checks** para monitorear el estado de tu aplicación PūrVita. Los health checks permiten que Cloudflare verifique periódicamente si tu servidor está disponible y responde correctamente.

### Características

✅ Endpoint específico sin rate limiting (`/api/health/cloudflare`)
✅ CSP configurado para permitir solicitudes de Cloudflare
✅ Respuestas rápidas y ligeras
✅ Logs de monitoreo
✅ Headers de seguridad

---

## 🚀 Configuración Rápida

### 1. Endpoint de Health Check

**URL:** `https://tu-dominio.com/api/health/cloudflare`

**Método:** GET

**Respuesta exitosa (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-13T10:30:45.123Z",
  "version": "PūrVita",
  "environment": "production"
}
```

**Respuesta de error (503):**
```json
{
  "status": "error",
  "message": "Health check failed",
  "timestamp": "2025-01-13T10:30:45.123Z"
}
```

### 2. Configurar en Cloudflare Dashboard

1. **Accede a Cloudflare Dashboard**
   - URL: https://dash.cloudflare.com/

2. **Navega a Load Balancing > Health Checks**
   - Selecciona tu dominio
   - Click en "Create Health Check"

3. **Configura los parámetros:**
   - **Name:** PūrVita Health Check
   - **Type:** HTTPS
   - **Host:** tu-dominio.com
   - **Path:** /api/health/cloudflare
   - **Port:** 443
   - **Protocol:** HTTPS
   - **Interval:** 30 segundos (recomendado)
   - **Timeout:** 5 segundos
   - **Retries:** 2
   - **Expected Code:** 200

4. **Headers opcionales:**
   - User-Agent: Cloudflare-Health-Check/1.0

5. **Click en "Create"**

---

## 🔒 Seguridad y CSP

### CSP Configurado

El endpoint está permitido en el CSP bajo `connect-src`:

```typescript
'https://api.cloudflare.com'  // Cloudflare API (Health Checks)
```

### Headers de Seguridad

El endpoint incluye automáticamente:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

---

## 📊 Monitoreo y Logs

### Logs en Servidor

Los health checks se registran en los logs del servidor:

```
[Cloudflare Health Check] {
  timestamp: "2025-01-13T10:30:45.123Z",
  userAgent: "Cloudflare-Health-Check/1.0",
  cfRay: "abc123def456-LAX",
  url: "https://tu-dominio.com/api/health/cloudflare"
}
```

### Verificar en Cloudflare

1. Cloudflare Dashboard > Load Balancing > Health Checks
2. Selecciona tu health check
3. Ver "Status" y "Last Check"

---

## 🔧 Configuración Avanzada

### Usar con Load Balancer

Si tienes múltiples servidores:

1. Crea un Load Balancer en Cloudflare
2. Agrega tus servidores como "Origins"
3. Asigna el Health Check a cada origin
4. Cloudflare automáticamente desactivará origins no saludables

### Alertas

Configura alertas en Cloudflare:

1. Notifications > Create Notification
2. Tipo: "Health Check"
3. Selecciona tu health check
4. Elige canal: Email, Slack, etc.

---

## 🧪 Pruebas

### Prueba Local

```bash
curl -v https://tu-dominio.com/api/health/cloudflare
```

### Prueba con Headers de Cloudflare

```bash
curl -v \
  -H "CF-Ray: abc123def456-LAX" \
  -H "User-Agent: Cloudflare-Health-Check/1.0" \
  https://tu-dominio.com/api/health/cloudflare
```

---

## ⚠️ Notas Importantes

1. **No Rate Limiting:** Este endpoint NO está sujeto a rate limiting
2. **Sin Autenticación:** No requiere tokens o credenciales
3. **Público:** Cualquiera puede acceder a este endpoint
4. **Ligero:** Responde rápidamente sin consultar la base de datos

---

## 📝 Troubleshooting

### Health Check falla

**Problema:** Cloudflare reporta "Unhealthy"

**Soluciones:**
1. Verifica que el dominio sea accesible: `curl https://tu-dominio.com/api/health/cloudflare`
2. Revisa los logs del servidor
3. Verifica que el CSP no bloquee la solicitud
4. Aumenta el timeout en Cloudflare

### CSP bloquea solicitudes

**Problema:** Ves errores de CSP en la consola

**Solución:** Ya está configurado en `src/lib/security/csp-nonce.ts`

---

## 📚 Referencias

- [Cloudflare Health Checks Docs](https://developers.cloudflare.com/load-balancing/health-checks/)
- [Endpoint Code](../src/app/api/health/cloudflare/route.ts)
- [CSP Configuration](../src/lib/security/csp-nonce.ts)

