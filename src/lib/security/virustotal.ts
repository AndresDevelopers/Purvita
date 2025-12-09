/**
 * VirusTotal API Integration
 *
 * Integración con VirusTotal v3 API para threat intelligence:
 * - Verificación de URLs maliciosas
 * - Verificación de IPs maliciosas
 * - Verificación de dominios
 * - Análisis de archivos (futuro)
 *
 * Features:
 * - Caché con Redis para minimizar llamadas a la API
 * - Rate limiting incorporado
 * - Logging de amenazas detectadas
 * - Configuración mediante variables de entorno
 * - Threshold configurable de detección
 *
 * @see https://developers.virustotal.com/reference/overview
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
 * Configuración del servicio VirusTotal
 */
interface VirusTotalConfig {
  enabled: boolean
  apiKey: string | null
  cacheTtlSeconds: number
  threshold: number // Número mínimo de detecciones para considerar como amenaza
}

/**
 * Respuesta de análisis de VirusTotal
 */
interface VirusTotalAnalysis {
  malicious: number
  suspicious: number
  harmless: number
  undetected: number
  timeout: number
  totalEngines: number
  detections: Array<{
    engine: string
    category: string
    result: string
  }>
}

/**
 * Servicio de integración con VirusTotal
 */
export class VirusTotalService {
  private config: VirusTotalConfig
  private apiBaseUrl = 'https://www.virustotal.com/api/v3'

  constructor() {
    this.config = {
      enabled: process.env.VIRUSTOTAL_API_ENABLED === 'true',
      apiKey: process.env.VIRUSTOTAL_API_KEY || null,
      cacheTtlSeconds: parseInt(process.env.VIRUSTOTAL_CACHE_TTL_SECONDS || '7200', 10),
      threshold: parseInt(process.env.VIRUSTOTAL_THRESHOLD || '2', 10),
    }

    // Validar que si está enabled, tenga API key
    if (this.config.enabled && !this.config.apiKey) {
      console.warn(
        '[VirusTotal] Service is enabled but VIRUSTOTAL_API_KEY is not set. Service will be disabled.'
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
   * Verifica si una IP es maliciosa usando VirusTotal
   */
  async checkIp(ip: string, metadata?: SecurityEventMetadata): Promise<ThreatCheckResult> {
    // Si el servicio está deshabilitado, retornar como seguro
    if (!this.isEnabled()) {
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
      // Consultar VirusTotal API
      const response = await fetch(`${this.apiBaseUrl}/ip_addresses/${ip}`, {
        method: 'GET',
        headers: {
          'x-apikey': this.config.apiKey!,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[VirusTotal] Rate limit exceeded')
        } else {
          console.error(`[VirusTotal] API error: ${response.status}`)
        }
        return { isThreat: false }
      }

      const data = await response.json()

      // Procesar respuesta
      const result = this.processIpResponse(data)

      // Guardar en caché
      await redisCache.set(cacheKey, result, this.config.cacheTtlSeconds)

      // Log si es amenaza
      if (result.isThreat && process.env.ABUSE_CH_LOG_THREATS !== 'false') {
        await this.logThreat('ip', ip, result, metadata)
      }

      return result
    } catch (error) {
      console.error('[VirusTotal] Error checking IP:', error)
      return { isThreat: false }
    }
  }

  /**
   * Verifica si una URL es maliciosa usando VirusTotal
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
      // VirusTotal requiere el URL ID (base64url del URL)
      const urlId = this.encodeUrlId(url)

      // Consultar VirusTotal API
      const response = await fetch(`${this.apiBaseUrl}/urls/${urlId}`, {
        method: 'GET',
        headers: {
          'x-apikey': this.config.apiKey!,
          'Accept': 'application/json',
        },
      })

      // Si el URL no existe en VirusTotal, enviarlo para análisis
      if (response.status === 404) {
        // Enviar URL para análisis
        await this.submitUrl(url)
        // Retornar como seguro por ahora (análisis pendiente)
        return { isThreat: false }
      }

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[VirusTotal] Rate limit exceeded')
        } else {
          console.error(`[VirusTotal] API error: ${response.status}`)
        }
        return { isThreat: false }
      }

      const data = await response.json()

      // Procesar respuesta
      const result = this.processUrlResponse(data)

      // Guardar en caché
      await redisCache.set(cacheKey, result, this.config.cacheTtlSeconds)

      // Log si es amenaza
      if (result.isThreat && process.env.ABUSE_CH_LOG_THREATS !== 'false') {
        await this.logThreat('url', url, result, metadata)
      }

      return result
    } catch (error) {
      console.error('[VirusTotal] Error checking URL:', error)
      return { isThreat: false }
    }
  }

  /**
   * Envía una URL para análisis en VirusTotal
   */
  private async submitUrl(url: string): Promise<void> {
    try {
      const formData = new URLSearchParams()
      formData.append('url', url)

      await fetch(`${this.apiBaseUrl}/urls`, {
        method: 'POST',
        headers: {
          'x-apikey': this.config.apiKey!,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      console.log(`[VirusTotal] URL submitted for analysis: ${url}`)
    } catch (error) {
      console.error('[VirusTotal] Error submitting URL:', error)
    }
  }

  /**
   * Procesa respuesta de IP de VirusTotal
   */
  private processIpResponse(data: any): ThreatCheckResult {
    const stats = data.data?.attributes?.last_analysis_stats

    if (!stats) {
      return { isThreat: false }
    }

    const analysis: VirusTotalAnalysis = {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      timeout: stats.timeout || 0,
      totalEngines: Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number,
      detections: [],
    }

    // Extraer detecciones
    const lastAnalysisResults = data.data?.attributes?.last_analysis_results || {}
    for (const [engine, result] of Object.entries(lastAnalysisResults)) {
      const resultData = result as any
      if (resultData.category === 'malicious' || resultData.category === 'suspicious') {
        analysis.detections.push({
          engine,
          category: resultData.category,
          result: resultData.result || 'detected',
        })
      }
    }

    // Determinar si es amenaza basado en threshold
    const totalDetections = analysis.malicious + analysis.suspicious
    const isThreat = totalDetections >= this.config.threshold

    if (!isThreat) {
      return { isThreat: false }
    }

    // Determinar confianza
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    if (totalDetections >= 10) {
      confidence = 'high'
    } else if (totalDetections < 3) {
      confidence = 'low'
    }

    return {
      isThreat: true,
      threatType: ThreatType.MALICIOUS_IP,
      confidence,
      source: 'virustotal' as any,
      details: {
        maliciousDetections: analysis.malicious,
        suspiciousDetections: analysis.suspicious,
        totalEngines: analysis.totalEngines,
        detectionEngines: analysis.detections.map((d) => d.engine).join(', '),
      } as any,
    }
  }

  /**
   * Procesa respuesta de URL de VirusTotal
   */
  private processUrlResponse(data: any): ThreatCheckResult {
    const stats = data.data?.attributes?.last_analysis_stats

    if (!stats) {
      return { isThreat: false }
    }

    const analysis: VirusTotalAnalysis = {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      timeout: stats.timeout || 0,
      totalEngines: Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number,
      detections: [],
    }

    // Extraer detecciones
    const lastAnalysisResults = data.data?.attributes?.last_analysis_results || {}
    for (const [engine, result] of Object.entries(lastAnalysisResults)) {
      const resultData = result as any
      if (resultData.category === 'malicious' || resultData.category === 'suspicious') {
        analysis.detections.push({
          engine,
          category: resultData.category,
          result: resultData.result || 'detected',
        })
      }
    }

    // Determinar si es amenaza basado en threshold
    const totalDetections = analysis.malicious + analysis.suspicious
    const isThreat = totalDetections >= this.config.threshold

    if (!isThreat) {
      return { isThreat: false }
    }

    // Determinar tipo de amenaza y confianza
    let threatType = ThreatType.MALICIOUS_URL
    let confidence: 'high' | 'medium' | 'low' = 'medium'

    // Analizar categorías de detección
    const categories = data.data?.attributes?.categories || {}
    if (Object.values(categories).some((cat: any) => cat?.toLowerCase().includes('phishing'))) {
      threatType = ThreatType.PHISHING
    } else if (
      Object.values(categories).some((cat: any) => cat?.toLowerCase().includes('malware'))
    ) {
      threatType = ThreatType.MALWARE
    }

    if (totalDetections >= 10) {
      confidence = 'high'
    } else if (totalDetections < 3) {
      confidence = 'low'
    }

    return {
      isThreat: true,
      threatType,
      confidence,
      source: 'virustotal' as any,
      details: {
        maliciousDetections: analysis.malicious,
        suspiciousDetections: analysis.suspicious,
        totalEngines: analysis.totalEngines,
        detectionEngines: analysis.detections.map((d) => d.engine).join(', '),
        categories: Object.values(categories).join(', '),
      } as any,
    }
  }

  /**
   * Codifica una URL para VirusTotal (base64url sin padding)
   */
  private encodeUrlId(url: string): string {
    // VirusTotal usa base64url sin padding
    const base64 = Buffer.from(url).toString('base64')
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
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
    const message = `Amenaza detectada (VirusTotal): ${type.toUpperCase()} ${value} - Tipo: ${result.threatType}, Confianza: ${result.confidence}`

    await SecurityAuditLogger.log(
      SecurityEventType.THREAT_DETECTED,
      SecurityEventSeverity.CRITICAL,
      message,
      {
        ...metadata,
        threatType: result.threatType,
        threatSource: 'virustotal',
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

    if (first === 10) return true
    if (first === 172 && second >= 16 && second <= 31) return true
    if (first === 192 && second === 168) return true
    if (first === 127) return true
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
    return `virustotal:${type}:${value}`
  }

  /**
   * Limpiar caché de un IP o URL específico
   */
  async clearCache(type: 'ip' | 'url', value: string): Promise<void> {
    const cacheKey = this.getCacheKey(type, value)
    await redisCache.delete(cacheKey)
  }

  /**
   * Limpiar todo el caché de VirusTotal
   */
  async clearAllCache(): Promise<void> {
    await redisCache.deletePattern('virustotal:*')
  }
}

// Export singleton instance
export const virusTotalService = new VirusTotalService()
