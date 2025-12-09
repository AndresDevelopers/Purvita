import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * Trusted Agent Service
 * 
 * Detects and validates trusted agents (Manus, etc.) that can bypass security protections.
 * Trusted agents can skip CAPTCHA, rate limiting, CSRF, and optionally CSP.
 */

interface TrustedAgent {
  id: string
  name: string
  user_agent_pattern: string | null
  ip_address: string | null
  api_key: string | null
  bypass_captcha: boolean
  bypass_rate_limiting: boolean
  bypass_csrf: boolean
  bypass_csp: boolean
  is_active: boolean
}

interface TrustedAgentDetection {
  isTrusted: boolean
  agent: TrustedAgent | null
  bypassCaptcha: boolean
  bypassRateLimiting: boolean
  bypassCsrf: boolean
  bypassCsp: boolean
}

class TrustedAgentService {
  private supabase
  private cache: Map<string, { agent: TrustedAgent | null; timestamp: number }> = new Map()
  private cacheTTL = 5 * 60 * 1000 // 5 minutes

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  /**
   * Detect if a request comes from a trusted agent
   */
  async detectTrustedAgent(request: NextRequest): Promise<TrustedAgentDetection> {
    const userAgent = request.headers.get('user-agent') || ''
    const ip = this.getClientIP(request)
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')

    // Check cache first
    const cacheKey = `${userAgent}:${ip}:${apiKey || ''}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return this.buildDetectionResult(cached.agent)
    }

    // Fetch active trusted agents from database
    const { data: agents, error } = await this.supabase
      .from('trusted_agents')
      .select('*')
      .eq('is_active', true)

    if (error || !agents || agents.length === 0) {
      this.cache.set(cacheKey, { agent: null, timestamp: Date.now() })
      return this.buildDetectionResult(null)
    }

    // Check each agent for a match
    for (const agent of agents) {
      // Check API key first (highest priority)
      if (agent.api_key && apiKey && agent.api_key === apiKey) {
        await this.updateLastUsed(agent.id)
        this.cache.set(cacheKey, { agent, timestamp: Date.now() })
        return this.buildDetectionResult(agent)
      }

      // Check IP address
      if (agent.ip_address && ip && agent.ip_address === ip) {
        await this.updateLastUsed(agent.id)
        this.cache.set(cacheKey, { agent, timestamp: Date.now() })
        return this.buildDetectionResult(agent)
      }

      // Check User-Agent pattern (regex)
      if (agent.user_agent_pattern && userAgent) {
        try {
          const regex = new RegExp(agent.user_agent_pattern, 'i')
          if (regex.test(userAgent)) {
            await this.updateLastUsed(agent.id)
            this.cache.set(cacheKey, { agent, timestamp: Date.now() })
            return this.buildDetectionResult(agent)
          }
        } catch (error) {
          console.error(`Invalid regex pattern for agent ${agent.name}:`, error)
        }
      }
    }

    // No match found
    this.cache.set(cacheKey, { agent: null, timestamp: Date.now() })
    return this.buildDetectionResult(null)
  }

  /**
   * Log trusted agent activity
   */
  async logAgentActivity(
    agent: TrustedAgent,
    request: NextRequest,
    bypassed: {
      captcha?: boolean
      rateLimiting?: boolean
      csrf?: boolean
      csp?: boolean
    },
    responseStatus?: number
  ): Promise<void> {
    const userAgent = request.headers.get('user-agent') || ''
    const ip = this.getClientIP(request)
    const { pathname } = request.nextUrl

    await this.supabase.from('trusted_agent_logs').insert({
      agent_id: agent.id,
      agent_name: agent.name,
      ip_address: ip,
      user_agent: userAgent,
      endpoint: pathname,
      method: request.method,
      bypassed_captcha: bypassed.captcha || false,
      bypassed_rate_limiting: bypassed.rateLimiting || false,
      bypassed_csrf: bypassed.csrf || false,
      bypassed_csp: bypassed.csp || false,
      response_status: responseStatus,
    })
  }

  /**
   * Build detection result
   */
  private buildDetectionResult(agent: TrustedAgent | null): TrustedAgentDetection {
    if (!agent) {
      return {
        isTrusted: false,
        agent: null,
        bypassCaptcha: false,
        bypassRateLimiting: false,
        bypassCsrf: false,
        bypassCsp: false,
      }
    }

    return {
      isTrusted: true,
      agent,
      bypassCaptcha: agent.bypass_captcha,
      bypassRateLimiting: agent.bypass_rate_limiting,
      bypassCsrf: agent.bypass_csrf,
      bypassCsp: agent.bypass_csp,
    }
  }

  /**
   * Update last_used_at timestamp
   */
  private async updateLastUsed(agentId: string): Promise<void> {
    await this.supabase
      .from('trusted_agents')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', agentId)
  }

  /**
   * Get client IP from request
   */
  private getClientIP(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown'
    )
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Singleton instance
let trustedAgentServiceInstance: TrustedAgentService | null = null

export function getTrustedAgentService(): TrustedAgentService {
  if (!trustedAgentServiceInstance) {
    trustedAgentServiceInstance = new TrustedAgentService()
  }
  return trustedAgentServiceInstance
}

export type { TrustedAgent, TrustedAgentDetection }

