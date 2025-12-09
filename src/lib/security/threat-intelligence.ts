/**
 * Threat Intelligence Orchestrator
 *
 * Orquestador de múltiples servicios de threat intelligence:
 * - abuse.ch (URLhaus, ThreatFox)
 * - VirusTotal
 * - Google Safe Browsing
 *
 * Features:
 * - Verificación en paralelo o secuencial
 * - Estrategias de decisión configurables (any, majority, all)
 * - Agregación de resultados de múltiples fuentes
 * - Configuración centralizada
 * - Fallback automático si un servicio falla
 *
 * @see docs/security-threat-intelligence.md
 */

import { abuseChService, ThreatCheckResult } from './abuse-ch'
import { virusTotalService } from './virustotal'
import { googleSafeBrowsingService } from './google-safe-browsing'
import { SecurityEventMetadata } from './audit-logger'

/**
 * Estrategias de decisión para múltiples servicios
 */
export enum ThreatStrategy {
  ANY = 'any', // Bloquear si CUALQUIER servicio detecta amenaza
  MAJORITY = 'majority', // Bloquear si la MAYORÍA detecta amenaza
  ALL = 'all', // Bloquear solo si TODOS detectan amenaza
}

/**
 * Resultado agregado de múltiples servicios
 */
export interface AggregatedThreatResult {
  isThreat: boolean
  confidence: 'high' | 'medium' | 'low'
  sources: Array<{
    name: string
    result: ThreatCheckResult
  }>
  summary: {
    totalServices: number
    threatsDetected: number
    safeDetected: number
    strategy: ThreatStrategy
  }
}

/**
 * Configuración del orquestador
 */
interface ThreatIntelligenceConfig {
  strategy: ThreatStrategy
  parallel: boolean
}

/**
 * Orquestador de Threat Intelligence
 */
export class ThreatIntelligenceOrchestrator {
  private config: ThreatIntelligenceConfig

  constructor() {
    this.config = {
      strategy: this.parseStrategy(process.env.THREAT_INTELLIGENCE_STRATEGY || 'any'),
      parallel: process.env.THREAT_INTELLIGENCE_PARALLEL !== 'false', // Por defecto true
    }
  }

  /**
   * Verifica una IP contra todos los servicios habilitados
   * Note: Auto-blocking is handled by the middleware (middleware.ts)
   */
  async checkIp(ip: string, metadata?: SecurityEventMetadata): Promise<AggregatedThreatResult> {
    const services = [
      { name: 'abuse.ch', service: abuseChService },
      { name: 'virustotal', service: virusTotalService },
    ]

    // Filtrar solo servicios habilitados
    const enabledServices = services.filter((s) => s.service.isEnabled())

    if (enabledServices.length === 0) {
      return this.createEmptyResult()
    }

    // Ejecutar verificaciones
    const results = await this.executeChecks(
      enabledServices,
      (service) => service.checkIp(ip, metadata)
    )

    return this.aggregateResults(results, this.config.strategy)
  }

  /**
   * Verifica una URL contra todos los servicios habilitados
   */
  async checkUrl(url: string, metadata?: SecurityEventMetadata): Promise<AggregatedThreatResult> {
    const services = [
      { name: 'abuse.ch', service: abuseChService },
      { name: 'virustotal', service: virusTotalService },
      { name: 'google-safe-browsing', service: googleSafeBrowsingService },
    ]

    // Filtrar solo servicios habilitados
    const enabledServices = services.filter((s) => s.service.isEnabled())

    if (enabledServices.length === 0) {
      return this.createEmptyResult()
    }

    // Ejecutar verificaciones
    const results = await this.executeChecks(
      enabledServices,
      (service) => service.checkUrl(url, metadata)
    )

    return this.aggregateResults(results, this.config.strategy)
  }

  /**
   * Ejecuta verificaciones en paralelo o secuencial
   */
  private async executeChecks<T extends { name: string; service: unknown }>(
    services: T[],
    checkFn: (service: any) => Promise<ThreatCheckResult>
  ): Promise<Array<{ name: string; result: ThreatCheckResult }>> {
    if (this.config.parallel) {
      // Ejecutar en paralelo
      const promises = services.map(async (s) => {
        try {
          const result = await checkFn(s.service)
          return { name: s.name, result }
        } catch (error) {
          console.error(`[ThreatIntelligence] Error checking with ${s.name}:`, error)
          return { name: s.name, result: { isThreat: false } }
        }
      })

      return await Promise.all(promises)
    } else {
      // Ejecutar secuencialmente
      const results: Array<{ name: string; result: ThreatCheckResult }> = []

      for (const s of services) {
        try {
          const result = await checkFn(s.service)
          results.push({ name: s.name, result })
        } catch (error) {
          console.error(`[ThreatIntelligence] Error checking with ${s.name}:`, error)
          results.push({ name: s.name, result: { isThreat: false } })
        }
      }

      return results
    }
  }

  /**
   * Agrega resultados de múltiples servicios según la estrategia
   */
  private aggregateResults(
    results: Array<{ name: string; result: ThreatCheckResult }>,
    strategy: ThreatStrategy
  ): AggregatedThreatResult {
    const totalServices = results.length
    const threatsDetected = results.filter((r) => r.result.isThreat).length
    const safeDetected = totalServices - threatsDetected

    // Determinar si es amenaza según la estrategia
    let isThreat = false

    switch (strategy) {
      case ThreatStrategy.ANY:
        isThreat = threatsDetected > 0
        break
      case ThreatStrategy.MAJORITY:
        isThreat = threatsDetected > safeDetected
        break
      case ThreatStrategy.ALL:
        isThreat = threatsDetected === totalServices
        break
    }

    // Determinar confianza global
    let confidence: 'high' | 'medium' | 'low' = 'medium'

    if (isThreat) {
      // Si todos o la mayoría detectan, alta confianza
      if (threatsDetected === totalServices) {
        confidence = 'high'
      } else if (threatsDetected > totalServices / 2) {
        confidence = 'medium'
      } else {
        confidence = 'low'
      }

      // Aumentar confianza si algún servicio tiene alta confianza
      const hasHighConfidence = results.some(
        (r) => r.result.isThreat && r.result.confidence === 'high'
      )
      if (hasHighConfidence && confidence === 'medium') {
        confidence = 'high'
      }
    }

    return {
      isThreat,
      confidence,
      sources: results,
      summary: {
        totalServices,
        threatsDetected,
        safeDetected,
        strategy,
      },
    }
  }

  /**
   * Crea resultado vacío cuando no hay servicios habilitados
   */
  private createEmptyResult(): AggregatedThreatResult {
    return {
      isThreat: false,
      confidence: 'low',
      sources: [],
      summary: {
        totalServices: 0,
        threatsDetected: 0,
        safeDetected: 0,
        strategy: this.config.strategy,
      },
    }
  }

  /**
   * Parsea la estrategia desde string
   */
  private parseStrategy(strategy: string): ThreatStrategy {
    switch (strategy.toLowerCase()) {
      case 'any':
        return ThreatStrategy.ANY
      case 'majority':
        return ThreatStrategy.MAJORITY
      case 'all':
        return ThreatStrategy.ALL
      default:
        console.warn(
          `[ThreatIntelligence] Invalid strategy "${strategy}". Using default "any".`
        )
        return ThreatStrategy.ANY
    }
  }

  /**
   * Obtiene estadísticas de servicios habilitados
   */
  getEnabledServices(): {
    abuseChEnabled: boolean
    virusTotalEnabled: boolean
    googleSafeBrowsingEnabled: boolean
    totalEnabled: number
  } {
    const abuseChEnabled = abuseChService.isEnabled()
    const virusTotalEnabled = virusTotalService.isEnabled()
    const googleSafeBrowsingEnabled = googleSafeBrowsingService.isEnabled()

    return {
      abuseChEnabled,
      virusTotalEnabled,
      googleSafeBrowsingEnabled,
      totalEnabled:
        (abuseChEnabled ? 1 : 0) +
        (virusTotalEnabled ? 1 : 0) +
        (googleSafeBrowsingEnabled ? 1 : 0),
    }
  }

  /**
   * Limpia todo el caché de threat intelligence
   */
  async clearAllCache(): Promise<void> {
    await Promise.all([
      abuseChService.clearAllCache(),
      virusTotalService.clearAllCache(),
      googleSafeBrowsingService.clearAllCache(),
    ])
  }
}

// Export singleton instance
export const threatIntelligence = new ThreatIntelligenceOrchestrator()

/**
 * Helper functions para uso rápido
 */

/**
 * Verifica si una IP es maliciosa usando todos los servicios
 */
export async function checkIpThreat(
  ip: string,
  metadata?: SecurityEventMetadata
): Promise<boolean> {
  const result = await threatIntelligence.checkIp(ip, metadata)
  return result.isThreat
}

/**
 * Verifica si una URL es maliciosa usando todos los servicios
 */
export async function checkUrlThreat(
  url: string,
  metadata?: SecurityEventMetadata
): Promise<boolean> {
  const result = await threatIntelligence.checkUrl(url, metadata)
  return result.isThreat
}

/**
 * Obtiene resultado detallado de verificación de IP
 */
export async function checkIpDetailed(
  ip: string,
  metadata?: SecurityEventMetadata
): Promise<AggregatedThreatResult> {
  return await threatIntelligence.checkIp(ip, metadata)
}

/**
 * Obtiene resultado detallado de verificación de URL
 */
export async function checkUrlDetailed(
  url: string,
  metadata?: SecurityEventMetadata
): Promise<AggregatedThreatResult> {
  return await threatIntelligence.checkUrl(url, metadata)
}
