/**
 * Google Safe Browsing API Integration
 *
 * Integración con Google Safe Browsing v4 API para threat intelligence:
 * - Verificación de URLs maliciosas (phishing, malware, unwanted software)
 * - Detección de social engineering
 * - Protección contra descargas potencialmente dañinas
 *
 * Features:
 * - Caché con Redis para minimizar llamadas a la API
 * - Logging de amenazas detectadas
 * - Configuración mediante variables de entorno
 * - Alta precisión con baja tasa de falsos positivos
 *
 * @see https://developers.google.com/safe-browsing/v4
 */

import { redisCache } from '@/lib/redis'
import {
  SecurityAuditLogger,
  SecurityEventMetadata,
  SecurityEventType,
  SecurityEventSeverity,
} from './audit-logger'
import { ThreatCheckResult, ThreatType } from './abuse-ch'

/**
 * Configuración del servicio Google Safe Browsing
 */
interface GoogleSafeBrowsingConfig {
  enabled: boolean
  apiKey: string | null
  cacheTtlSeconds: number
}

/**
 * Tipos de amenazas de Google Safe Browsing
 */
enum GoogleThreatType {
  MALWARE = 'MALWARE',
  SOCIAL_ENGINEERING = 'SOCIAL_ENGINEERING',
  UNWANTED_SOFTWARE = 'UNWANTED_SOFTWARE',
  POTENTIALLY_HARMFUL_APPLICATION = 'POTENTIALLY_HARMFUL_APPLICATION',
}

/**
 * Plataformas soportadas
 */
enum GooglePlatformType {
  ANY_PLATFORM = 'ANY_PLATFORM',
  WINDOWS = 'WINDOWS',
  LINUX = 'LINUX',
  ANDROID = 'ANDROID',
  OSX = 'OSX',
  IOS = 'IOS',
  CHROME = 'CHROME',
}

/**
 * Tipos de entrada de amenaza
 */
enum GoogleThreatEntryType {
  URL = 'URL',
  EXECUTABLE = 'EXECUTABLE',
}

/**
 * Servicio de integración con Google Safe Browsing
 */
export class GoogleSafeBrowsingService {
  private config: GoogleSafeBrowsingConfig
  private apiBaseUrl = 'https://safebrowsing.googleapis.com/v4/threatMatches:find'

  constructor() {
    this.config = {
      enabled: process.env.GOOGLE_SAFE_BROWSING_ENABLED === 'true',
      apiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY || null,
      cacheTtlSeconds: parseInt(process.env.GOOGLE_SAFE_BROWSING_CACHE_TTL_SECONDS || '1800', 10),
    }

    // Validar que si está enabled, tenga API key
    if (this.config.enabled && !this.config.apiKey) {
      console.warn(
        '[GoogleSafeBrowsing] Service is enabled but GOOGLE_SAFE_BROWSING_API_KEY is not set. Service will be disabled.'
      )
      this.config.enabled = false
    }
  }

  /**
   * Verifica si el servicio está habilitado
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.apiKey !== null
  }

  /**
   * Verifica si una URL es maliciosa usando Google Safe Browsing
   */
  async checkUrl(url: string, metadata?: SecurityEventMetadata): Promise<ThreatCheckResult> {
    // Si el servicio está deshabilitado, retornar como seguro
    if (!this.isEnabled()) {
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
      // Preparar request para Google Safe Browsing
      const requestBody = {
        client: {
          clientId: 'purvita',
          clientVersion: '1.0.0',
        },
        threatInfo: {
          threatTypes: [
            GoogleThreatType.MALWARE,
            GoogleThreatType.SOCIAL_ENGINEERING,
            GoogleThreatType.UNWANTED_SOFTWARE,
            GoogleThreatType.POTENTIALLY_HARMFUL_APPLICATION,
          ],
          platformTypes: [GooglePlatformType.ANY_PLATFORM],
          threatEntryTypes: [GoogleThreatEntryType.URL],
          threatEntries: [{ url }],
        },
      }

      // Consultar Google Safe Browsing API
      const response = await fetch(`${this.apiBaseUrl}?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[GoogleSafeBrowsing] Rate limit exceeded')
        } else {
          console.error(`[GoogleSafeBrowsing] API error: ${response.status}`)
        }
        return { isThreat: false }
      }

      const data = await response.json()

      // Procesar respuesta
      const result = this.processResponse(data, url)

      // Guardar en caché
      await redisCache.set(cacheKey, result, this.config.cacheTtlSeconds)

      // Log si es amenaza
      if (result.isThreat && process.env.ABUSE_CH_LOG_THREATS !== 'false') {
        await this.logThreat(url, result, metadata)
      }

      return result
    } catch (error) {
      console.error('[GoogleSafeBrowsing] Error checking URL:', error)
      return { isThreat: false }
    }
  }

  /**
   * Verifica múltiples URLs en una sola llamada
   */
  async checkUrls(
    urls: string[],
    metadata?: SecurityEventMetadata
  ): Promise<Map<string, ThreatCheckResult>> {
    const results = new Map<string, ThreatCheckResult>()

    // Si el servicio está deshabilitado, retornar todas como seguras
    if (!this.isEnabled()) {
      urls.forEach((url) => results.set(url, { isThreat: false }))
      return results
    }

    // Verificar caché primero
    const uncachedUrls: string[] = []
    for (const url of urls) {
      const cacheKey = this.getCacheKey('url', url)
      const cached = await redisCache.get<ThreatCheckResult>(cacheKey)
      if (cached) {
        results.set(url, cached)
      } else {
        uncachedUrls.push(url)
      }
    }

    // Si todas estaban en caché, retornar
    if (uncachedUrls.length === 0) {
      return results
    }

    try {
      // Preparar request para Google Safe Browsing
      const requestBody = {
        client: {
          clientId: 'purvita',
          clientVersion: '1.0.0',
        },
        threatInfo: {
          threatTypes: [
            GoogleThreatType.MALWARE,
            GoogleThreatType.SOCIAL_ENGINEERING,
            GoogleThreatType.UNWANTED_SOFTWARE,
            GoogleThreatType.POTENTIALLY_HARMFUL_APPLICATION,
          ],
          platformTypes: [GooglePlatformType.ANY_PLATFORM],
          threatEntryTypes: [GoogleThreatEntryType.URL],
          threatEntries: uncachedUrls.map((url) => ({ url })),
        },
      }

      // Consultar Google Safe Browsing API
      const response = await fetch(`${this.apiBaseUrl}?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        console.error(`[GoogleSafeBrowsing] API error: ${response.status}`)
        // Marcar todas como seguras en caso de error
        uncachedUrls.forEach((url) => results.set(url, { isThreat: false }))
        return results
      }

      const data = await response.json()

      // Procesar respuesta para cada URL
      for (const url of uncachedUrls) {
        const result = this.processResponse(data, url)
        results.set(url, result)

        // Guardar en caché
        const cacheKey = this.getCacheKey('url', url)
        await redisCache.set(cacheKey, result, this.config.cacheTtlSeconds)

        // Log si es amenaza
        if (result.isThreat && process.env.ABUSE_CH_LOG_THREATS !== 'false') {
          await this.logThreat(url, result, metadata)
        }
      }

      return results
    } catch (error) {
      console.error('[GoogleSafeBrowsing] Error checking URLs:', error)
      // Marcar todas como seguras en caso de error
      uncachedUrls.forEach((url) => results.set(url, { isThreat: false }))
      return results
    }
  }

  /**
   * Procesa respuesta de Google Safe Browsing
   */
  private processResponse(data: any, url: string): ThreatCheckResult {
    // Si no hay matches, es seguro
    if (!data.matches || data.matches.length === 0) {
      return { isThreat: false }
    }

    // Buscar matches para esta URL específica
    const urlMatches = data.matches.filter((match: any) => match.threat?.url === url)

    if (urlMatches.length === 0) {
      return { isThreat: false }
    }

    // Tomar el primer match
    const match = urlMatches[0]

    // Determinar tipo de amenaza
    let threatType = ThreatType.MALICIOUS_URL
    switch (match.threatType) {
      case GoogleThreatType.SOCIAL_ENGINEERING:
        threatType = ThreatType.PHISHING
        break
      case GoogleThreatType.MALWARE:
      case GoogleThreatType.UNWANTED_SOFTWARE:
      case GoogleThreatType.POTENTIALLY_HARMFUL_APPLICATION:
        threatType = ThreatType.MALWARE
        break
    }

    return {
      isThreat: true,
      threatType,
      confidence: 'high', // Google Safe Browsing es muy preciso
      source: 'google-safe-browsing' as any,
      details: {
        threatType: match.threatType,
        platformType: match.platformType,
        cacheDuration: match.cacheDuration,
      } as any,
    }
  }

  /**
   * Log de amenaza detectada
   */
  private async logThreat(
    url: string,
    result: ThreatCheckResult,
    metadata?: SecurityEventMetadata
  ): Promise<void> {
    const message = `Amenaza detectada (Google Safe Browsing): URL ${url} - Tipo: ${result.threatType}, Confianza: ${result.confidence}`

    await SecurityAuditLogger.log(
      SecurityEventType.THREAT_DETECTED,
      SecurityEventSeverity.CRITICAL,
      message,
      {
        ...metadata,
        threatType: result.threatType,
        threatSource: 'google-safe-browsing',
        threatDetails: result.details,
        url,
      },
      false
    )
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
  private getCacheKey(type: 'url', value: string): string {
    return `google-safe-browsing:${type}:${value}`
  }

  /**
   * Limpiar caché de una URL específica
   */
  async clearCache(url: string): Promise<void> {
    const cacheKey = this.getCacheKey('url', url)
    await redisCache.delete(cacheKey)
  }

  /**
   * Limpiar todo el caché de Google Safe Browsing
   */
  async clearAllCache(): Promise<void> {
    await redisCache.deletePattern('google-safe-browsing:*')
  }
}

// Export singleton instance
export const googleSafeBrowsingService = new GoogleSafeBrowsingService()
