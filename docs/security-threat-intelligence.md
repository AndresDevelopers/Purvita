# Threat Intelligence - Multi-Layer Security

## Descripción

PurVita implementa un sistema de seguridad multicapa combinando **tres servicios de threat intelligence** líderes en la industria:

1. **abuse.ch** (URLhaus + ThreatFox) - Base de datos comunitaria de amenazas
2. **VirusTotal** - Escaneo con 70+ motores antivirus
3. **Google Safe Browsing** - Protección de Google contra phishing y malware

Esta integración proporciona:
- ✅ Detección de IPs maliciosas
- ✅ Detección de URLs de phishing y malware
- ✅ Verificación en tiempo real
- ✅ Caché inteligente con Redis
- ✅ Estrategias configurables de decisión
- ✅ Ejecución en paralelo para mejor rendimiento

## Arquitectura

### Servicios Disponibles

| Servicio | APIs | Requiere API Key | Detección |
|----------|------|------------------|-----------|
| **abuse.ch** | URLhaus, ThreatFox | ❌ No (gratuito) | IPs, URLs |
| **VirusTotal** | v3 API | ✅ Sí (gratuita) | IPs, URLs, Dominios |
| **Google Safe Browsing** | v4 API | ✅ Sí (gratuita) | URLs |

### Orquestador de Threat Intelligence

El orquestador combina los resultados de múltiples servicios usando estrategias configurables:

```
┌─────────────────────────────────────────────┐
│         Threat Intelligence                 │
│            Orchestrator                     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────┐│
│  │  abuse.ch   │  │ VirusTotal  │  │Google││
│  │             │  │             │  │Safe  ││
│  │ • URLhaus   │  │ • 70+ AV    │  │Browse││
│  │ • ThreatFox │  │ • Real-time │  │      ││
│  └─────────────┘  └─────────────┘  └──────┘│
│         │                 │            │    │
│         └─────────┬───────┴────────────┘    │
│                   │                         │
│            ┌──────▼──────┐                  │
│            │  Aggregator │                  │
│            │  Strategy   │                  │
│            └─────────────┘                  │
│                                             │
│  Strategies:                                │
│  • any      - 1+ detecta = BLOQUEAR        │
│  • majority - >50% detecta = BLOQUEAR      │
│  • all      - 100% detecta = BLOQUEAR      │
└─────────────────────────────────────────────┘
```

## Configuración

### 1. Variables de Entorno

Agrega estas variables en tu archivo `.env.local` o `.env`:

#### abuse.ch (No requiere API key)

```bash
# Habilitar abuse.ch
ABUSE_CH_API_ENABLED=true
ABUSE_CH_URLHAUS_ENABLED=true
ABUSE_CH_THREATFOX_ENABLED=true
ABUSE_CH_CACHE_TTL_SECONDS=3600
```

#### VirusTotal (Requiere API key)

```bash
# Habilitar VirusTotal
VIRUSTOTAL_API_ENABLED=true
VIRUSTOTAL_API_KEY=tu_api_key_de_virustotal_aqui
VIRUSTOTAL_CACHE_TTL_SECONDS=7200
VIRUSTOTAL_THRESHOLD=2  # Mínimo de detecciones para considerar amenaza
```

**Obtener API key de VirusTotal (GRATIS):**
1. Regístrate en: https://www.virustotal.com/gui/join-us
2. Ve a tu perfil y copia tu API key
3. Plan gratuito: 500 requests/día, 4 requests/minuto

#### Google Safe Browsing (Requiere API key)

```bash
# Habilitar Google Safe Browsing
GOOGLE_SAFE_BROWSING_ENABLED=true
GOOGLE_SAFE_BROWSING_API_KEY=tu_api_key_de_google_aqui
GOOGLE_SAFE_BROWSING_CACHE_TTL_SECONDS=1800
```

**Obtener API key de Google Safe Browsing (GRATIS):**
1. Ve a: https://console.cloud.google.com/
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita "Safe Browsing API"
4. Ve a "Credenciales" → "Crear credenciales" → "API Key"
5. Copia tu API key
6. Plan gratuito: 10,000 requests/día

#### Configuración Global

```bash
# Estrategia de decisión
# any = Bloquear si CUALQUIER servicio detecta (MÁS ESTRICTO)
# majority = Bloquear si la MAYORÍA detecta (BALANCEADO)
# all = Bloquear solo si TODOS detectan (MÁS PERMISIVO)
THREAT_INTELLIGENCE_STRATEGY=any

# Ejecutar verificaciones en paralelo (más rápido)
THREAT_INTELLIGENCE_PARALLEL=true
```

### 2. Configuración Recomendada

#### Desarrollo

```bash
# Solo abuse.ch (no requiere API key)
ABUSE_CH_API_ENABLED=true
THREAT_INTELLIGENCE_STRATEGY=any
```

#### Producción (Máxima Protección)

```bash
# Los 3 servicios habilitados
ABUSE_CH_API_ENABLED=true
VIRUSTOTAL_API_ENABLED=true
VIRUSTOTAL_API_KEY=tu_key_aqui
GOOGLE_SAFE_BROWSING_ENABLED=true
GOOGLE_SAFE_BROWSING_API_KEY=tu_key_aqui

# Estrategia estricta
THREAT_INTELLIGENCE_STRATEGY=any
THREAT_INTELLIGENCE_PARALLEL=true
```

## Uso

### Verificación Automática en Middleware

**TODAS las peticiones a la API son verificadas automáticamente**. No requiere configuración adicional.

```typescript
// Automático - ya integrado en middleware.ts
// Todas las peticiones a /api/* verifican la IP del cliente
// Si la IP es maliciosa → Bloqueo 403
```

### Verificación Manual de IPs

```typescript
import { threatIntelligence } from '@/lib/security/threat-intelligence';

// Verificación simple (true/false)
const result = await threatIntelligence.checkIp('192.0.2.1');
if (result.isThreat) {
  console.log('IP maliciosa detectada');
  console.log('Confianza:', result.confidence); // high, medium, low
  console.log('Servicios que detectaron:', result.sources.filter(s => s.result.isThreat));
}

// Ver qué servicios están habilitados
const services = threatIntelligence.getEnabledServices();
console.log('Servicios habilitados:', services.totalEnabled);
console.log('- abuse.ch:', services.abuseChEnabled);
console.log('- VirusTotal:', services.virusTotalEnabled);
console.log('- Google Safe Browsing:', services.googleSafeBrowsingEnabled);
```

### Verificación Manual de URLs

```typescript
import { threatIntelligence } from '@/lib/security/threat-intelligence';

const result = await threatIntelligence.checkUrl('https://example.com');

if (result.isThreat) {
  console.log('URL maliciosa detectada');
  console.log('Confianza:', result.confidence);

  // Ver qué servicios detectaron la amenaza
  result.sources.forEach(source => {
    if (source.result.isThreat) {
      console.log(`- ${source.name} detectó: ${source.result.threatType}`);
    }
  });
}
```

### Validación de URLs en Formularios

```typescript
import { validateUrlsInText } from '@/lib/security/url-threat-validator';

// Automáticamente extrae y verifica URLs en texto
const userMessage = 'Visita mi sitio en https://example.com';

const validation = await validateUrlsInText(userMessage, {
  action: 'contact_form',
  userEmail: 'user@example.com'
});

if (!validation.isValid) {
  console.log('URLs maliciosas encontradas:', validation.threats);
  // Bloquear el envío
}
```

### Uso en API Routes Personalizadas

```typescript
// src/app/api/mi-endpoint/route.ts
import { threatIntelligence } from '@/lib/security/threat-intelligence';

export async function POST(request: Request) {
  const body = await request.json();

  // Verificar URL en el body
  if (body.url) {
    const result = await threatIntelligence.checkUrl(body.url);

    if (result.isThreat) {
      return new Response(
        JSON.stringify({
          error: 'Malicious URL detected',
          details: {
            confidence: result.confidence,
            detectedBy: result.sources
              .filter(s => s.result.isThreat)
              .map(s => s.name)
          }
        }),
        { status: 400 }
      );
    }
  }

  // Continuar con tu lógica...
}
```

## Estrategias de Decisión

### ANY (Por Defecto - Más Estricto)

Bloquea si **CUALQUIER** servicio detecta una amenaza.

```
Escenario: Verificando una URL

abuse.ch:     ✅ Amenaza detectada
VirusTotal:   ❌ No detectada
Google:       ❌ No detectada

Resultado: BLOQUEADO ✅
Confianza: LOW (solo 1 de 3 servicios)
```

**Ventajas:**
- Máxima protección
- Detecta amenazas zero-day
- Menos falsos negativos

**Desventajas:**
- Más falsos positivos
- Más estricto

### MAJORITY (Balanceado)

Bloquea si la **MAYORÍA** (>50%) detecta una amenaza.

```
Escenario: Verificando una URL

abuse.ch:     ✅ Amenaza detectada
VirusTotal:   ✅ Amenaza detectada
Google:       ❌ No detectada

Resultado: BLOQUEADO ✅
Confianza: MEDIUM (2 de 3 servicios)
```

**Ventajas:**
- Balance entre seguridad y usabilidad
- Menos falsos positivos que ANY
- Buena confianza

**Desventajas:**
- Puede perder amenazas detectadas por un solo servicio

### ALL (Más Permisivo)

Bloquea solo si **TODOS** los servicios detectan una amenaza.

```
Escenario: Verificando una URL

abuse.ch:     ✅ Amenaza detectada
VirusTotal:   ✅ Amenaza detectada
Google:       ❌ No detectada

Resultado: PERMITIDO ❌
```

**Ventajas:**
- Mínimos falsos positivos
- Máxima confianza cuando detecta

**Desventajas:**
- Menos seguro
- Puede perder amenazas legítimas

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

## Performance y Caché

### Tiempos de Respuesta

| Escenario | Tiempo | Descripción |
|-----------|--------|-------------|
| **Caché hit** | <5ms | Resultado en Redis |
| **IP privada** | <1ms | Skip automático |
| **abuse.ch** (sin caché) | 200-500ms | Primera consulta |
| **VirusTotal** (sin caché) | 300-800ms | Primera consulta |
| **Google Safe Browsing** (sin caché) | 100-300ms | Primera consulta |
| **3 servicios en paralelo** | 300-800ms | Max del más lento |

### Configuración de Caché Recomendada

```bash
# abuse.ch - Actualización rápida de amenazas
ABUSE_CH_CACHE_TTL_SECONDS=3600  # 1 hora

# VirusTotal - Base de datos más estable
VIRUSTOTAL_CACHE_TTL_SECONDS=7200  # 2 horas

# Google Safe Browsing - Actualizaciones frecuentes
GOOGLE_SAFE_BROWSING_CACHE_TTL_SECONDS=1800  # 30 minutos
```

### Rate Limits

| Servicio | Plan Gratuito | Límite |
|----------|---------------|--------|
| **abuse.ch** | ✅ Sí | Sin límite oficial (usar con moderación) |
| **VirusTotal** | ✅ Sí | 500 requests/día, 4 requests/min |
| **Google Safe Browsing** | ✅ Sí | 10,000 requests/día |

**Recomendación:** El caché es CRÍTICO para no exceder los límites.

## Monitoreo

### Ver Logs de Seguridad

```sql
-- Ver amenazas detectadas hoy
SELECT
  timestamp,
  message,
  metadata->>'ipAddress' as ip,
  metadata->>'threatConfidence' as confidence,
  metadata->>'threatSources' as detected_by
FROM security_audit_logs
WHERE event_type = 'security.threat.detected'
AND timestamp > CURRENT_DATE
ORDER BY timestamp DESC;

-- Estadísticas por servicio
SELECT
  metadata->>'threatSources' as service,
  COUNT(*) as detections
FROM security_audit_logs
WHERE event_type IN (
  'security.threat.detected',
  'security.ip.malicious.blocked',
  'security.url.malicious.blocked'
)
AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY metadata->>'threatSources'
ORDER BY detections DESC;
```

### Métricas Importantes

1. **Amenazas bloqueadas por día**
2. **Distribución de confianza** (high/medium/low)
3. **Servicios más efectivos** (cuál detecta más)
4. **Tipos de amenazas** (phishing, malware, botnet)
5. **Falsos positivos** (si usuarios reportan)

## Troubleshooting

### Problema: Servicios no funcionan

```bash
# Verificar configuración
curl http://localhost:3000/api/health

# Ver logs
npm run dev

# Verificar servicios habilitados
console.log(threatIntelligence.getEnabledServices());
```

### Problema: Rate limit excedido de VirusTotal

```bash
# Aumentar TTL del caché
VIRUSTOTAL_CACHE_TTL_SECONDS=14400  # 4 horas

# O deshabilitar temporalmente
VIRUSTOTAL_API_ENABLED=false
```

### Problema: Muchos falsos positivos

```bash
# Cambiar estrategia a mayoría o todos
THREAT_INTELLIGENCE_STRATEGY=majority

# O ajustar threshold de VirusTotal
VIRUSTOTAL_THRESHOLD=5  # Más permisivo
```

### Problema: Muy lento

```bash
# Verificar que está en paralelo
THREAT_INTELLIGENCE_PARALLEL=true

# Verificar que Redis está configurado
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Deshabilitar servicios innecesarios
GOOGLE_SAFE_BROWSING_ENABLED=false
```

## Best Practices

1. **✅ Siempre habilita Redis** para caché
2. **✅ Usa estrategia 'any'** en producción para máxima seguridad
3. **✅ Monitorea falsos positivos** y ajusta threshold
4. **✅ Configura los 3 servicios** para mejor cobertura
5. **✅ Ejecuta en paralelo** para mejor performance
6. **❌ No hagas verificaciones síncronas** sin caché
7. **❌ No uses API keys en el código** (solo env variables)

## Roadmap

- [ ] Soporte para verificación de archivos (hashes)
- [ ] Whitelist de IPs/URLs confiables
- [ ] Dashboard de métricas en tiempo real
- [ ] Integración con más servicios (AlienVault OTX, etc.)
- [ ] Machine learning para detección de patrones
- [ ] Webhooks para alertas críticas

## Comparación con Otros Servicios

| Feature | abuse.ch | VirusTotal | Google SB | PurVita |
|---------|----------|------------|-----------|---------|
| **API Key requerida** | ❌ | ✅ | ✅ | ❌* |
| **IP detection** | ✅ | ✅ | ❌ | ✅ |
| **URL detection** | ✅ | ✅ | ✅ | ✅ |
| **Múltiples motores AV** | ❌ | ✅ (70+) | ❌ | ✅ |
| **Caché** | ❌ | ❌ | ❌ | ✅ |
| **Múltiples servicios** | ❌ | ❌ | ❌ | ✅ |
| **Estrategias** | ❌ | ❌ | ❌ | ✅ |
| **Ejecución paralela** | ❌ | ❌ | ❌ | ✅ |

*abuse.ch funciona sin API key

## Soporte

Para reportar problemas o sugerencias:
- GitHub Issues: https://github.com/AndresDevelopers/PurVita/issues
- Documentación individual:
  - [abuse.ch](./security-abuse-ch.md)

## Referencias

- [abuse.ch](https://abuse.ch)
- [VirusTotal API v3](https://developers.virustotal.com/reference/overview)
- [Google Safe Browsing API v4](https://developers.google.com/safe-browsing/v4)
- [Security Documentation](./security.md)
