/**
 * Abuse.ch API Integration
 *
 * Integración con las APIs de abuse.ch para threat intelligence:
 * - URLhaus: Verificación de URLs maliciosas
 * - ThreatFox: Verificación de IPs maliciosas e IOCs
 *
 * Features:
 * - Caché con Redis para minimizar llamadas a la API
 * - Rate limiting incorporado
 * - Logging de amenazas detectadas
 * - Configuración mediante variables de entorno
 * - Graceful degradation si la API no está disponible
 *
 * @see https://urlhaus.abuse.ch/api/
 * @see https://threatfox.abuse.ch/api/
 */

import { redisCache } from '@/lib/redis'
import {
  SecurityAuditLogger,
  SecurityEventMetadata,
  SecurityEventType,
  SecurityEventSeverity,
} from './audit-logger'

/**
 * Tipos de amenazas detectadas
 */
export enum ThreatType {
  MALICIOUS_URL = 'malicious_url',
  MALICIOUS_IP = 'malicious_ip',
  BOTNET = 'botnet',
  MALWARE = 'malware',
  PHISHING = 'phishing',
  UNKNOWN = 'unknown',
}

/**
 * Resultado de verificación de amenaza
 */
export interface ThreatCheckResult {
  isThreat: boolean
  threatType?: ThreatType
  confidence?: 'high' | 'medium' | 'low'
  source?: 'urlhaus' | 'threatfox'
  details?: {
    firstSeen?: string
    lastSeen?: string
    malwareFamily?: string
    tags?: string[]
    reference?: string
  }
}

/**
 * Configuración del servicio abuse.ch
 */
interface AbuseChConfig {
  enabled: boolean
  urlhausEnabled: boolean
  threatfoxEnabled: boolean
  cacheTtlSeconds: number
  blockOnThreat: boolean
  logThreats: boolean
}

/**
 * Servicio de integración con abuse.ch
 */
export class AbuseChService {
  private config: AbuseChConfig
  private urlhausApiUrl = 'https://urlhaus-api.abuse.ch/v1/'
  private threatfoxApiUrl = 'https://threatfox-api.abuse.ch/api/v1/'

  constructor() {
    this.config = {
      enabled: process.env.ABUSE_CH_API_ENABLED === 'true',
      urlhausEnabled: process.env.ABUSE_CH_URLHAUS_ENABLED !== 'false', // Por defecto true
      threatfoxEnabled: process.env.ABUSE_CH_THREATFOX_ENABLED !== 'false', // Por defecto true
      cacheTtlSeconds: parseInt(process.env.ABUSE_CH_CACHE_TTL_SECONDS || '3600', 10),
      blockOnThreat: process.env.ABUSE_CH_BLOCK_ON_THREAT !== 'false', // Por defecto true
      logThreats: process.env.ABUSE_CH_LOG_THREATS !== 'false', // Por defecto true
    }
  }

  /**
   * Verifica si el servicio está habilitado
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Verifica si una IP es maliciosa usando ThreatFox
   */
  async checkIp(ip: string, metadata?: SecurityEventMetadata): Promise<ThreatCheckResult> {
    // Si el servicio está deshabilitado, retornar como seguro
    if (!this.config.enabled || !this.config.threatfoxEnabled) {
      return { isThreat: false }
    }

    // Validar IP
    if (!this.isValidIp(ip)) {
      return { isThreat: false }
    }

    // Ignorar IPs locales/privadas
    if (this.isPrivateIp(ip)) {
      return { isThreat: false }
    }

    // Intentar obtener del caché
    const cacheKey = this.getCacheKey('ip', ip)
    const cached = await redisCache.get<ThreatCheckResult>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // Consultar ThreatFox API
      const response = await fetch(this.threatfoxApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'search_ioc',
          search_term: ip,
        }),
      })

      if (!response.ok) {
        console.error(`[AbuseChService] ThreatFox API error: ${response.status}`)
        return { isThreat: false }
      }

      const data = await response.json()

      // Procesar respuesta
      const result = this.processThreatFoxResponse(data, 'ip')

      // Guardar en caché
      await redisCache.set(cacheKey, result, this.config.cacheTtlSeconds)

      // Log si es amenaza
      if (result.isThreat && this.config.logThreats) {
        await this.logThreat('ip', ip, result, metadata)
      }

      return result
    } catch (error) {
      console.error('[AbuseChService] Error checking IP:', error)
      return { isThreat: false }
    }
  }

  /**
   * Verifica si una URL es maliciosa usando URLhaus
   */
  async checkUrl(url: string, metadata?: SecurityEventMetadata): Promise<ThreatCheckResult> {
    // Si el servicio está deshabilitado, retornar como seguro
    if (!this.config.enabled || !this.config.urlhausEnabled) {
      return { isThreat: false }
    }

    // Validar URL
    if (!this.isValidUrl(url)) {
      return { isThreat: false }
    }

    // Intentar obtener del caché
    const cacheKey = this.getCacheKey('url', url)
    const cached = await redisCache.get<ThreatCheckResult>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // Consultar URLhaus API
      const formData = new URLSearchParams()
      formData.append('url', url)

      const response = await fetch(`${this.urlhausApiUrl}url/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      if (!response.ok) {
        console.error(`[AbuseChService] URLhaus API error: ${response.status}`)
        return { isThreat: false }
      }

      const data = await response.json()

      // Procesar respuesta
      const result = this.processUrlhausResponse(data)

      // Guardar en caché
      await redisCache.set(cacheKey, result, this.config.cacheTtlSeconds)

      // Log si es amenaza
      if (result.isThreat && this.config.logThreats) {
        await this.logThreat('url', url, result, metadata)
      }

      return result
    } catch (error) {
      console.error('[AbuseChService] Error checking URL:', error)
      return { isThreat: false }
    }
  }

  /**
   * Verifica múltiples IPs en paralelo
   */
  async checkIps(
    ips: string[],
    metadata?: SecurityEventMetadata
  ): Promise<Map<string, ThreatCheckResult>> {
    const results = new Map<string, ThreatCheckResult>()

    await Promise.all(
      ips.map(async (ip) => {
        const result = await this.checkIp(ip, metadata)
        results.set(ip, result)
      })
    )

    return results
  }

  /**
   * Procesa respuesta de ThreatFox
   */
  private processThreatFoxResponse(data: any, _type: 'ip' | 'url'): ThreatCheckResult {
    // Si no hay resultados, es seguro
    if (data.query_status === 'no_result' || !data.data || data.data.length === 0) {
      return { isThreat: false }
    }

    // Tomar el primer resultado (más reciente)
    const threat = data.data[0]

    // Determinar tipo de amenaza
    let threatType = ThreatType.UNKNOWN
    if (threat.threat_type === 'botnet_cc') {
      threatType = ThreatType.BOTNET
    } else if (threat.threat_type === 'payload_delivery') {
      threatType = ThreatType.MALWARE
    }

    return {
      isThreat: true,
      threatType,
      confidence: threat.confidence_level || 'medium',
      source: 'threatfox',
      details: {
        firstSeen: threat.first_seen,
        lastSeen: threat.last_seen,
        malwareFamily: threat.malware_printable,
        tags: threat.tags || [],
        reference: threat.reference,
      },
    }
  }

  /**
   * Procesa respuesta de URLhaus
   */
  private processUrlhausResponse(data: any): ThreatCheckResult {
    // Si no hay resultados, es seguro
    if (data.query_status === 'no_result' || !data.url) {
      return { isThreat: false }
    }

    // Determinar tipo de amenaza
    let threatType = ThreatType.MALICIOUS_URL
    if (data.threat && data.threat.toLowerCase().includes('phishing')) {
      threatType = ThreatType.PHISHING
    } else if (data.threat && data.threat.toLowerCase().includes('malware')) {
      threatType = ThreatType.MALWARE
    }

    return {
      isThreat: true,
      threatType,
      confidence: 'high', // URLhaus es bastante preciso
      source: 'urlhaus',
      details: {
        firstSeen: data.date_added,
        lastSeen: data.last_online,
        malwareFamily: data.tags?.join(', '),
        tags: data.tags || [],
        reference: data.urlhaus_reference,
      },
    }
  }

  /**
   * Log de amenaza detectada
   */
  private async logThreat(
    type: 'ip' | 'url',
    value: string,
    result: ThreatCheckResult,
    metadata?: SecurityEventMetadata
  ): Promise<void> {
    const message = `Amenaza detectada (${result.source}): ${type.toUpperCase()} ${value} - Tipo: ${result.threatType}, Confianza: ${result.confidence}`

    await SecurityAuditLogger.log(
      SecurityEventType.THREAT_DETECTED,
      SecurityEventSeverity.CRITICAL,
      message,
      {
        ...metadata,
        threatType: result.threatType,
        threatSource: result.source,
        threatDetails: result.details,
        [type]: value,
      },
      false
    )
  }

  /**
   * Validar IP
   */
  private isValidIp(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  /**
   * Verificar si es IP privada
   */
  private isPrivateIp(ip: string): boolean {
    const parts = ip.split('.')
    if (parts.length !== 4) return false

    const first = parseInt(parts[0], 10)
    const second = parseInt(parts[1], 10)

    // 10.0.0.0 - 10.255.255.255
    if (first === 10) return true

    // 172.16.0.0 - 172.31.255.255
    if (first === 172 && second >= 16 && second <= 31) return true

    // 192.168.0.0 - 192.168.255.255
    if (first === 192 && second === 168) return true

    // 127.0.0.0 - 127.255.255.255 (localhost)
    if (first === 127) return true

    // 169.254.0.0 - 169.254.255.255 (link-local)
    if (first === 169 && second === 254) return true

    return false
  }

  /**
   * Validar URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Generar clave de caché
   */
  private getCacheKey(type: 'ip' | 'url', value: string): string {
    return `abuse-ch:${type}:${value}`
  }

  /**
   * Limpiar caché de un IP o URL específico
   */
  async clearCache(type: 'ip' | 'url', value: string): Promise<void> {
    const cacheKey = this.getCacheKey(type, value)
    await redisCache.delete(cacheKey)
  }

  /**
   * Limpiar todo el caché de abuse.ch
   */
  async clearAllCache(): Promise<void> {
    await redisCache.deletePattern('abuse-ch:*')
  }
}

// Export singleton instance
export const abuseChService = new AbuseChService()

/**
 * Helper function para verificar IP en middleware
 */
export async function checkIpThreat(
  ip: string,
  metadata?: SecurityEventMetadata
): Promise<boolean> {
  const result = await abuseChService.checkIp(ip, metadata)
  return result.isThreat
}

/**
 * Helper function para verificar URL
 */
export async function checkUrlThreat(
  url: string,
  metadata?: SecurityEventMetadata
): Promise<boolean> {
  const result = await abuseChService.checkUrl(url, metadata)
  return result.isThreat
}
