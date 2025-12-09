# Integración con Abuse.ch - Threat Intelligence

## Descripción

PurVita está integrado con [abuse.ch](https://abuse.ch), una plataforma de threat intelligence que proporciona información en tiempo real sobre amenazas de seguridad, incluyendo:

- **URLhaus**: Base de datos de URLs maliciosas (malware, phishing, etc.)
- **ThreatFox**: Indicadores de compromiso (IOCs) incluyendo IPs maliciosas, botnets, etc.

Esta integración protege automáticamente la aplicación detectando y bloqueando:
- ✅ IPs maliciosas conocidas (botnets, malware C&C, etc.)
- ✅ URLs de phishing y malware en formularios de usuario
- ✅ Intentos de spam y fraude

## Características

### 1. Verificación Automática de IPs en Middleware

Todas las peticiones a la API son verificadas automáticamente contra ThreatFox. Si una IP está identificada como maliciosa, la petición es bloqueada inmediatamente.

**Ubicación**: `middleware.ts`

```typescript
// Automático - no requiere configuración adicional
// Todas las peticiones a /api/* son verificadas
```

### 2. Validación de URLs en Formularios

Los formularios que aceptan contenido de usuario (como el formulario de contacto) verifican automáticamente cualquier URL incluida en el contenido.

**Ubicación**: `src/modules/contact/services/contact-service.ts`

```typescript
import { validateUrlsInText } from '@/lib/security/url-threat-validator';

// Ejemplo en tu código
const urlValidation = await validateUrlsInText(userMessage, {
  action: 'form_submission',
  userEmail: userEmail,
});

if (!urlValidation.isValid) {
  // Bloquear el envío
  throw new Error('Suspicious content detected');
}
```

### 3. Caché Inteligente con Redis

Los resultados de las verificaciones se cachean en Redis para:
- Minimizar llamadas a la API externa
- Mejorar rendimiento
- Reducir latencia

**TTL por defecto**: 1 hora (configurable)

### 4. Audit Logging

Todas las amenazas detectadas se registran automáticamente en:
- Base de datos (tabla `security_audit_logs`)
- Consola (desarrollo)
- Logs de aplicación (producción)

**Eventos registrados**:
- `security.threat.detected` - Amenaza detectada
- `security.ip.malicious.blocked` - IP maliciosa bloqueada
- `security.url.malicious.blocked` - URL maliciosa bloqueada

## Configuración

### Variables de Entorno

Agrega estas variables en tu archivo `.env.local` o `.env`:

```bash
# ==============================================================================
# ABUSE.CH API - THREAT INTELLIGENCE
# ==============================================================================

# Habilitar/deshabilitar la integración (requerido)
ABUSE_CH_API_ENABLED=true

# Habilitar verificación de URLs maliciosas vía URLhaus
ABUSE_CH_URLHAUS_ENABLED=true

# Habilitar verificación de IPs maliciosas vía ThreatFox
ABUSE_CH_THREATFOX_ENABLED=true

# Tiempo de vida del caché en segundos (por defecto: 3600 = 1 hora)
ABUSE_CH_CACHE_TTL_SECONDS=3600

# Bloquear automáticamente amenazas detectadas (recomendado)
ABUSE_CH_BLOCK_ON_THREAT=true

# Registrar amenazas en audit log (recomendado)
ABUSE_CH_LOG_THREATS=true
```

### Valores por Defecto

Si no configuras las variables, estos son los valores por defecto:

| Variable | Valor por Defecto | Descripción |
|----------|------------------|-------------|
| `ABUSE_CH_API_ENABLED` | `false` | Servicio deshabilitado |
| `ABUSE_CH_URLHAUS_ENABLED` | `true` | Verificar URLs |
| `ABUSE_CH_THREATFOX_ENABLED` | `true` | Verificar IPs |
| `ABUSE_CH_CACHE_TTL_SECONDS` | `3600` | Caché de 1 hora |
| `ABUSE_CH_BLOCK_ON_THREAT` | `true` | Bloquear amenazas |
| `ABUSE_CH_LOG_THREATS` | `true` | Registrar en logs |

## Uso

### Verificar una IP

```typescript
import { abuseChService } from '@/lib/security/abuse-ch';

// Verificar una IP individual
const result = await abuseChService.checkIp('192.0.2.1', {
  ipAddress: '192.0.2.1',
  requestPath: '/api/endpoint',
});

if (result.isThreat) {
  console.log('¡IP maliciosa detectada!');
  console.log('Tipo:', result.threatType);
  console.log('Confianza:', result.confidence);
  console.log('Detalles:', result.details);
}
```

### Verificar una URL

```typescript
import { abuseChService } from '@/lib/security/abuse-ch';

// Verificar una URL
const result = await abuseChService.checkUrl('https://example.com', {
  action: 'url_check',
});

if (result.isThreat) {
  console.log('¡URL maliciosa detectada!');
  console.log('Tipo:', result.threatType);
}
```

### Verificar Múltiples IPs

```typescript
import { abuseChService } from '@/lib/security/abuse-ch';

const ips = ['192.0.2.1', '192.0.2.2', '192.0.2.3'];
const results = await abuseChService.checkIps(ips);

results.forEach((result, ip) => {
  if (result.isThreat) {
    console.log(`IP ${ip} es maliciosa`);
  }
});
```

### Validar URLs en Texto

```typescript
import { validateUrlsInText } from '@/lib/security/url-threat-validator';

const userMessage = 'Visita mi sitio en https://example.com para más info';

const validation = await validateUrlsInText(userMessage, {
  action: 'message_validation',
});

if (!validation.isValid) {
  console.log('URLs maliciosas encontradas:', validation.threats);
  // Bloquear el mensaje
}
```

### Limpiar Caché

```typescript
import { abuseChService } from '@/lib/security/abuse-ch';

// Limpiar caché de una IP específica
await abuseChService.clearCache('ip', '192.0.2.1');

// Limpiar caché de una URL específica
await abuseChService.clearCache('url', 'https://example.com');

// Limpiar todo el caché de abuse.ch
await abuseChService.clearAllCache();
```

## API de abuse.ch

### APIs Utilizadas

1. **ThreatFox API**
   - Endpoint: `https://threatfox-api.abuse.ch/api/v1/`
   - Documentación: https://threatfox.abuse.ch/api/
   - Rate Limit: Sin API key tiene límites (recomendado cachear)

2. **URLhaus API**
   - Endpoint: `https://urlhaus-api.abuse.ch/v1/`
   - Documentación: https://urlhaus.abuse.ch/api/
   - Rate Limit: Sin API key tiene límites (recomendado cachear)

### API Keys (Opcional)

Las APIs de abuse.ch son públicas y no requieren API key para uso básico. Sin embargo, puedes obtener una API key para:
- Mayor rate limit
- Acceso prioritario
- Soporte premium

Visita https://abuse.ch para más información.

## Tipos de Amenazas Detectadas

```typescript
enum ThreatType {
  MALICIOUS_URL = 'malicious_url',     // URL maliciosa genérica
  MALICIOUS_IP = 'malicious_ip',       // IP maliciosa genérica
  BOTNET = 'botnet',                   // Botnet C&C server
  MALWARE = 'malware',                 // Distribución de malware
  PHISHING = 'phishing',               // Sitio de phishing
  UNKNOWN = 'unknown',                 // Tipo desconocido
}
```

## Integración en Endpoints Personalizados

Para proteger tus propios endpoints:

```typescript
// src/app/api/mi-endpoint/route.ts
import { abuseChService } from '@/lib/security/abuse-ch';
import { validateUrlsInText } from '@/lib/security/url-threat-validator';

export async function POST(request: Request) {
  // 1. Verificar IP del usuario (automático en middleware, opcional aquí)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim();

  if (ip) {
    const ipCheck = await abuseChService.checkIp(ip);
    if (ipCheck.isThreat) {
      return new Response('Access Denied', { status: 403 });
    }
  }

  // 2. Validar URLs en el body
  const body = await request.json();

  if (body.message) {
    const urlValidation = await validateUrlsInText(body.message);
    if (!urlValidation.isValid) {
      return new Response('Suspicious content detected', { status: 400 });
    }
  }

  // 3. Continuar con tu lógica normal
  // ...
}
```

## Monitoreo y Alertas

### Ver Logs de Seguridad

```sql
-- Ver amenazas detectadas en las últimas 24 horas
SELECT
  timestamp,
  event_type,
  message,
  metadata->>'ipAddress' as ip,
  metadata->>'threatType' as threat_type,
  metadata->>'threatSource' as source
FROM security_audit_logs
WHERE event_type IN (
  'security.threat.detected',
  'security.ip.malicious.blocked',
  'security.url.malicious.blocked'
)
AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### Métricas Importantes

1. **Número de IPs bloqueadas por día**
2. **Tipos de amenazas más comunes**
3. **Endpoints más atacados**
4. **Tasa de falsos positivos**

## Performance

### Impacto en Latencia

- **Primera verificación** (sin caché): ~200-500ms
- **Verificaciones subsiguientes** (con caché): <5ms
- **IPs privadas/locales**: <1ms (skip automático)

### Optimizaciones Implementadas

1. ✅ Caché con Redis (TTL configurable)
2. ✅ Skip de IPs privadas (10.x.x.x, 192.168.x.x, etc.)
3. ✅ Validación de formato antes de llamar a la API
4. ✅ Verificación asíncrona en background
5. ✅ Graceful degradation si la API no está disponible

## Troubleshooting

### La integración no funciona

1. Verifica que `ABUSE_CH_API_ENABLED=true`
2. Verifica conectividad a internet desde tu servidor
3. Revisa los logs para errores de API

### Muchos falsos positivos

1. Ajusta `ABUSE_CH_BLOCK_ON_THREAT=false` temporalmente
2. Revisa los logs para identificar patrones
3. Considera whitelist de IPs legítimas

### Performance lento

1. Verifica que Redis está configurado y funcionando
2. Aumenta el `ABUSE_CH_CACHE_TTL_SECONDS`
3. Considera deshabilitar en desarrollo: `ABUSE_CH_API_ENABLED=false`

## Seguridad y Privacidad

### Datos Compartidos con abuse.ch

- IPs de usuarios (solo cuando se verifica)
- URLs enviadas en formularios (solo cuando se verifica)
- **NO** se comparte ninguna información personal identificable

### Cumplimiento GDPR

- Los datos enviados a abuse.ch son públicos (IPs/URLs)
- No se envía información personal
- Los logs locales respetan las políticas de retención de datos

## Roadmap

- [ ] Integración con MalwareBazaar (hashes de archivos)
- [ ] Dashboard de métricas de seguridad
- [ ] Webhooks para alertas críticas
- [ ] Whitelist de IPs confiables
- [ ] Integración con sistemas SIEM

## Soporte

Para reportar problemas o sugerencias:
- GitHub Issues: https://github.com/AndresDevelopers/PurVita/issues
- Documentación de abuse.ch: https://abuse.ch

## Referencias

- [abuse.ch](https://abuse.ch)
- [URLhaus API Docs](https://urlhaus.abuse.ch/api/)
- [ThreatFox API Docs](https://threatfox.abuse.ch/api/)
- [PurVita Security Documentation](./security.md)
