/**
 * Auto-Block Service
 * 
 * Automatically blocks IPs and creates fraud alerts when threats are detected
 * by threat intelligence services (VirusTotal, Google Safe Browsing, Abuse.ch)
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { AggregatedThreatResult } from './threat-intelligence';
import { getRateLimitConfig } from '@/lib/helpers/rate-limit-config-helper';

interface AutoBlockConfig {
  enabled: boolean;
  blockDurationHours: number; // Duration for automatic blocks
  minConfidence: number; // Minimum confidence level to auto-block (0-100)
}

interface BlockIPParams {
  ipAddress: string;
  reason: string;
  threatResult: AggregatedThreatResult;
  metadata?: {
    requestPath?: string;
    requestMethod?: string;
    userAgent?: string;
    userId?: string;
  };
}

interface FraudAlertParams {
  userId: string;
  ipAddress: string;
  threatResult: AggregatedThreatResult;
  metadata?: {
    requestPath?: string;
    requestMethod?: string;
    userAgent?: string;
  };
}

export class AutoBlockService {
  private config: AutoBlockConfig | null = null;

  /**
   * Get configuration from database (with fallback to environment variables)
   */
  private async getConfig(): Promise<AutoBlockConfig> {
    if (this.config) {
      return this.config;
    }

    const dbConfig = await getRateLimitConfig();
    this.config = {
      enabled: dbConfig.autoBlockEnabled,
      blockDurationHours: dbConfig.autoBlockDurationHours,
      minConfidence: dbConfig.autoBlockMinConfidence,
    };

    return this.config;
  }

  /**
   * Check if auto-blocking is enabled
   */
  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  /**
   * Automatically block an IP address detected as malicious
   */
  async blockMaliciousIP(params: BlockIPParams): Promise<boolean> {
    const config = await this.getConfig();

    if (!config.enabled) {
      return false;
    }

    // Convert string confidence to numeric score
    const confidenceScore = this.confidenceToScore(params.threatResult.confidence);

    // Check if confidence meets minimum threshold
    if (confidenceScore < config.minConfidence) {
      logger.info('Threat confidence below threshold, skipping auto-block', {
        ipAddress: params.ipAddress,
        confidence: params.threatResult.confidence,
        confidenceScore,
        minConfidence: config.minConfidence,
      });
      return false;
    }

    try {
      const supabase = createAdminClient();

      // Check if IP is already blocked
      const { data: existing } = await supabase
        .from('blocked_ips')
        .select('id')
        .eq('ip_address', params.ipAddress)
        .single();

      if (existing) {
        logger.info('IP already blocked, skipping', {
          ipAddress: params.ipAddress,
        });
        return false;
      }

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + config.blockDurationHours);

      // Build detailed reason
      const detectedSources = params.threatResult.sources
        .filter((s) => s.result.isThreat)
        .map((s) => s.name)
        .join(', ');

      const reason = `Auto-blocked: ${params.reason} (Detected by: ${detectedSources}, Confidence: ${params.threatResult.confidence}%)`;

      // Build notes with threat details
      const notes = JSON.stringify({
        autoBlocked: true,
        threatSummary: params.threatResult.summary,
        confidence: params.threatResult.confidence,
        sources: params.threatResult.sources.map((s) => ({
          name: s.name,
          isThreat: s.result.isThreat,
          threatType: s.result.threatType,
          confidence: s.result.confidence,
        })),
        metadata: params.metadata,
        blockedAt: new Date().toISOString(),
      });

      // Insert blocked IP
      const { error } = await supabase
        .from('blocked_ips')
        .insert({
          ip_address: params.ipAddress,
          reason,
          expires_at: expiresAt.toISOString(),
          notes,
          blocked_by: null, // System-generated block
        });

      if (error) {
        logger.error('Failed to auto-block IP', error as Error, {
          ipAddress: params.ipAddress,
        });
        return false;
      }

      logger.info('IP auto-blocked successfully', {
        ipAddress: params.ipAddress,
        reason,
        expiresAt: expiresAt.toISOString(),
        confidence: params.threatResult.confidence,
      });

      return true;
    } catch (error) {
      logger.error('Error in auto-block service', error as Error, {
        ipAddress: params.ipAddress,
      });
      return false;
    }
  }

  /**
   * Create a fraud alert for a user associated with malicious activity
   */
  async createFraudAlert(params: FraudAlertParams): Promise<boolean> {
    const config = await this.getConfig();

    if (!config.enabled) {
      return false;
    }

    try {
      const supabase = createAdminClient();

      // Build risk factors from threat result
      const riskFactors = params.threatResult.sources
        .filter((s) => s.result.isThreat)
        .map((s) => ({
          type: 'malicious_ip',
          source: s.name,
          severity: s.result.threatType || 'unknown',
          confidence: s.result.confidence || 0,
          description: s.result.details || 'Malicious IP detected by threat intelligence',
        }));

      // Calculate risk score (0-100)
      const riskScore = Math.min(100, this.confidenceToScore(params.threatResult.confidence));

      // Determine risk level
      let riskLevel: 'minimal' | 'low' | 'medium' | 'high';
      if (riskScore >= 80) {
        riskLevel = 'high';
      } else if (riskScore >= 60) {
        riskLevel = 'medium';
      } else if (riskScore >= 40) {
        riskLevel = 'low';
      } else {
        riskLevel = 'minimal';
      }

      // Build fraud stats
      const fraudStats = {
        ipAddress: params.ipAddress,
        threatSummary: params.threatResult.summary,
        detectedSources: params.threatResult.sources
          .filter((s) => s.result.isThreat)
          .map((s) => s.name),
        metadata: params.metadata,
        detectedAt: new Date().toISOString(),
      };

      // Insert fraud alert
      const { error } = await supabase
        .from('wallet_fraud_alerts')
        .insert({
          user_id: params.userId,
          risk_score: riskScore,
          risk_level: riskLevel,
          risk_factors: riskFactors,
          fraud_stats: fraudStats,
          status: 'pending',
        });

      if (error) {
        logger.error('Failed to create fraud alert', error as Error, {
          userId: params.userId,
          ipAddress: params.ipAddress,
        });
        return false;
      }

      logger.info('Fraud alert created successfully', {
        userId: params.userId,
        ipAddress: params.ipAddress,
        riskScore,
        riskLevel,
      });

      return true;
    } catch (error) {
      logger.error('Error creating fraud alert', error as Error, {
        userId: params.userId,
        ipAddress: params.ipAddress,
      });
      return false;
    }
  }

  /**
   * Process a threat detection and take appropriate actions
   * (block IP and create fraud alert if user is identified)
   */
  async processThreatDetection(
    ipAddress: string,
    threatResult: AggregatedThreatResult,
    metadata?: {
      requestPath?: string;
      requestMethod?: string;
      userAgent?: string;
      userId?: string;
    }
  ): Promise<{ ipBlocked: boolean; alertCreated: boolean }> {
    const results = {
      ipBlocked: false,
      alertCreated: false,
    };

    if (!threatResult.isThreat) {
      return results;
    }

    // Auto-block the IP
    results.ipBlocked = await this.blockMaliciousIP({
      ipAddress,
      reason: 'Malicious IP detected by threat intelligence',
      threatResult,
      metadata,
    });

    // Create fraud alert if user is identified
    if (metadata?.userId) {
      results.alertCreated = await this.createFraudAlert({
        userId: metadata.userId,
        ipAddress,
        threatResult,
        metadata,
      });
    }

    return results;
  }

  /**
   * Convert string confidence level to numeric score (0-100)
   */
  private confidenceToScore(confidence: 'high' | 'medium' | 'low'): number {
    switch (confidence) {
      case 'high':
        return 90;
      case 'medium':
        return 60;
      case 'low':
        return 30;
      default:
        return 0;
    }
  }
}

// Export singleton instance
export const autoBlockService = new AutoBlockService();

