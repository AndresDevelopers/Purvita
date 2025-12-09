/**
 * URL Threat Validator
 *
 * Utilidad para detectar y validar URLs en contenido de usuario
 * usando múltiples servicios de threat intelligence
 *
 * Features:
 * - Extracción automática de URLs de texto
 * - Validación contra múltiples servicios (abuse.ch, VirusTotal, Google Safe Browsing)
 * - Bloqueo opcional de contenido con URLs maliciosas
 * - Logging de intentos de envío de URLs maliciosas
 */

import { threatIntelligence, AggregatedThreatResult } from './threat-intelligence'
import {
  SecurityAuditLogger,
  SecurityEventType,
  SecurityEventSeverity,
  SecurityEventMetadata,
} from './audit-logger'

/**
 * Resultado de validación de URLs en contenido
 */
export interface UrlValidationResult {
  isValid: boolean
  foundUrls: string[]
  threats: Array<{
    url: string
    result: AggregatedThreatResult
  }>
}

/**
 * Extrae URLs de un texto
 */
export function extractUrls(text: string): string[] {
  // Regex para detectar URLs (HTTP, HTTPS, FTP, etc.)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi
  const matches = text.match(urlRegex)

  if (!matches) {
    return []
  }

  // Normalizar URLs (agregar protocolo si falta)
  return matches.map((url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    } else if (url.startsWith('www.')) {
      return `https://${url}`
    } else {
      return `https://${url}`
    }
  })
}

/**
 * Valida URLs en un texto contra múltiples servicios de threat intelligence
 */
export async function validateUrlsInText(
  text: string,
  metadata?: SecurityEventMetadata
): Promise<UrlValidationResult> {
  // Extraer URLs del texto
  const foundUrls = extractUrls(text)

  // Verificar si hay servicios habilitados
  const services = threatIntelligence.getEnabledServices()

  // Si no hay URLs o no hay servicios habilitados, retornar válido
  if (foundUrls.length === 0 || services.totalEnabled === 0) {
    return {
      isValid: true,
      foundUrls,
      threats: [],
    }
  }

  // Verificar cada URL
  const threats: Array<{ url: string; result: AggregatedThreatResult }> = []

  for (const url of foundUrls) {
    const result = await threatIntelligence.checkUrl(url, metadata)

    if (result.isThreat) {
      threats.push({ url, result })
    }
  }

  // Si hay amenazas, log y retornar inválido
  if (threats.length > 0) {
    for (const threat of threats) {
      const detectedSources = threat.result.sources
        .filter((s) => s.result.isThreat)
        .map((s) => s.name)
        .join(', ')

      await SecurityAuditLogger.log(
        SecurityEventType.MALICIOUS_URL_BLOCKED,
        SecurityEventSeverity.CRITICAL,
        `Blocked content with malicious URL: ${threat.url} (detected by: ${detectedSources})`,
        {
          ...metadata,
          url: threat.url,
          threatConfidence: threat.result.confidence,
          threatSources: detectedSources,
          threatSummary: threat.result.summary,
        },
        false
      )
    }

    return {
      isValid: false,
      foundUrls,
      threats,
    }
  }

  return {
    isValid: true,
    foundUrls,
    threats: [],
  }
}

/**
 * Middleware helper para validar URLs en campos de formulario
 */
export async function validateFormUrls(
  fields: Record<string, string>,
  metadata?: SecurityEventMetadata
): Promise<{ isValid: boolean; blockedFields: string[] }> {
  const blockedFields: string[] = []

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (typeof fieldValue === 'string' && fieldValue.length > 0) {
      const validation = await validateUrlsInText(fieldValue, {
        ...metadata,
        fieldName,
      })

      if (!validation.isValid) {
        blockedFields.push(fieldName)
      }
    }
  }

  return {
    isValid: blockedFields.length === 0,
    blockedFields,
  }
}
