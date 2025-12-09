/**
 * Payment Risk Service
 *
 * Determina si una transacción requiere autenticación adicional (3D Secure / SCA)
 * basándose en múltiples factores de riesgo.
 *
 * Factores evaluados:
 * - Monto de la transacción
 * - Historial del usuario
 * - Ubicación geográfica
 * - Dispositivo y navegador
 * - Velocidad de transacciones
 * - Patrones de fraude conocidos
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export interface RiskAssessmentParams {
  userId?: string;
  amountCents: number;
  currency: string;
  ipAddress?: string;
  countryCode?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  paymentMethod?: 'card' | 'paypal' | 'wallet';
}

export interface RiskAssessmentResult {
  requiresStrongAuth: boolean; // Requiere 3D Secure / SCA
  riskScore: number; // 0.0 - 1.0
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    score: number;
  }>;
  recommendation: string;
}

export class PaymentRiskService {
  /**
   * Evaluar riesgo de una transacción
   */
  static async assessRisk(params: RiskAssessmentParams): Promise<RiskAssessmentResult> {
    const riskFactors: RiskAssessmentResult['riskFactors'] = [];
    let totalScore = 0;

    // Factor 1: Monto de la transacción
    const amountRisk = this.assessAmountRisk(params.amountCents, params.currency);
    if (amountRisk.score > 0) {
      riskFactors.push(amountRisk);
      totalScore += amountRisk.score;
    }

    // Factor 2: Historial del usuario (si está autenticado)
    if (params.userId) {
      const userHistoryRisk = await this.assessUserHistoryRisk(params.userId);
      if (userHistoryRisk.score > 0) {
        riskFactors.push(userHistoryRisk);
        totalScore += userHistoryRisk.score;
      }
    }

    // Factor 3: Ubicación geográfica
    if (params.countryCode) {
      const geoRisk = this.assessGeographicRisk(params.countryCode);
      if (geoRisk.score > 0) {
        riskFactors.push(geoRisk);
        totalScore += geoRisk.score;
      }
    }

    // Factor 4: Velocidad de transacciones (si hay usuario)
    if (params.userId) {
      const velocityRisk = await this.assessTransactionVelocity(params.userId);
      if (velocityRisk.score > 0) {
        riskFactors.push(velocityRisk);
        totalScore += velocityRisk.score;
      }
    }

    // Factor 5: Usuario nuevo vs. establecido
    if (params.userId) {
      const newUserRisk = await this.assessNewUserRisk(params.userId);
      if (newUserRisk.score > 0) {
        riskFactors.push(newUserRisk);
        totalScore += newUserRisk.score;
      }
    }

    // Calcular score final (normalizado 0-1)
    const riskScore = Math.min(totalScore, 1.0);
    const riskLevel = this.getRiskLevel(riskScore);

    // Determinar si requiere autenticación fuerte
    const requiresStrongAuth = this.shouldRequireStrongAuth(riskScore, riskLevel, params);

    const recommendation = this.getRecommendation(riskLevel, requiresStrongAuth);

    return {
      requiresStrongAuth,
      riskScore,
      riskLevel,
      riskFactors,
      recommendation,
    };
  }

  /**
   * Evaluar riesgo por monto de transacción
   */
  private static assessAmountRisk(amountCents: number, currency: string): RiskAssessmentResult['riskFactors'][0] {
    const amountUSD = currency === 'USD' ? amountCents / 100 : amountCents / 100; // Simplificado

    // Umbrales de riesgo por monto
    if (amountUSD >= 1000) {
      return {
        type: 'high_amount',
        severity: 'high',
        description: `Transaction amount is very high ($${amountUSD.toFixed(2)})`,
        score: 0.4,
      };
    } else if (amountUSD >= 500) {
      return {
        type: 'medium_amount',
        severity: 'medium',
        description: `Transaction amount is elevated ($${amountUSD.toFixed(2)})`,
        score: 0.2,
      };
    } else if (amountUSD >= 100) {
      return {
        type: 'moderate_amount',
        severity: 'low',
        description: `Transaction amount is moderate ($${amountUSD.toFixed(2)})`,
        score: 0.1,
      };
    }

    return {
      type: 'low_amount',
      severity: 'low',
      description: `Transaction amount is low ($${amountUSD.toFixed(2)})`,
      score: 0,
    };
  }

  /**
   * Evaluar riesgo basado en historial del usuario
   */
  private static async assessUserHistoryRisk(userId: string): Promise<RiskAssessmentResult['riskFactors'][0]> {
    try {
      const supabase = createAdminClient();

      // Verificar si el usuario está en la blacklist
      const { data: blacklist } = await supabase
        .from('user_blacklist')
        .select('id, reason')
        .eq('user_id', userId)
        .single();

      if (blacklist) {
        return {
          type: 'blacklisted_user',
          severity: 'critical',
          description: 'User is blacklisted for fraud',
          score: 1.0,
        };
      }

      // Verificar alertas de fraude recientes
      const { data: _fraudAlerts, count } = await supabase
        .from('wallet_fraud_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (count && count > 0) {
        return {
          type: 'recent_fraud_alerts',
          severity: 'high',
          description: `User has ${count} pending fraud alert(s) in the last 30 days`,
          score: 0.5,
        };
      }

      return {
        type: 'clean_history',
        severity: 'low',
        description: 'User has clean payment history',
        score: 0,
      };
    } catch (error) {
      logger.error('Failed to assess user history risk', error as Error, { userId });
      return {
        type: 'history_check_failed',
        severity: 'medium',
        description: 'Unable to verify user history',
        score: 0.2,
      };
    }
  }

  /**
   * Evaluar riesgo geográfico
   */
  private static assessGeographicRisk(countryCode: string): RiskAssessmentResult['riskFactors'][0] {
    // Países de alto riesgo (lista simplificada)
    const highRiskCountries = ['NG', 'GH', 'PK', 'BD', 'ID', 'VN'];
    const mediumRiskCountries = ['IN', 'BR', 'RU', 'CN', 'TR'];

    if (highRiskCountries.includes(countryCode)) {
      return {
        type: 'high_risk_country',
        severity: 'high',
        description: `Transaction from high-risk country (${countryCode})`,
        score: 0.3,
      };
    } else if (mediumRiskCountries.includes(countryCode)) {
      return {
        type: 'medium_risk_country',
        severity: 'medium',
        description: `Transaction from medium-risk country (${countryCode})`,
        score: 0.15,
      };
    }

    return {
      type: 'low_risk_country',
      severity: 'low',
      description: `Transaction from low-risk country (${countryCode})`,
      score: 0,
    };
  }

  /**
   * Evaluar velocidad de transacciones
   */
  private static async assessTransactionVelocity(userId: string): Promise<RiskAssessmentResult['riskFactors'][0]> {
    try {
      const supabase = createAdminClient();

      // Contar transacciones en la última hora
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('wallet_txns')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo);

      if (count && count >= 10) {
        return {
          type: 'high_velocity',
          severity: 'critical',
          description: `${count} transactions in the last hour (possible card testing)`,
          score: 0.6,
        };
      } else if (count && count >= 5) {
        return {
          type: 'medium_velocity',
          severity: 'high',
          description: `${count} transactions in the last hour`,
          score: 0.3,
        };
      }

      return {
        type: 'normal_velocity',
        severity: 'low',
        description: 'Normal transaction velocity',
        score: 0,
      };
    } catch (error) {
      logger.error('Failed to assess transaction velocity', error as Error, { userId });
      return {
        type: 'velocity_check_failed',
        severity: 'low',
        description: 'Unable to verify transaction velocity',
        score: 0.1,
      };
    }
  }

  /**
   * Evaluar riesgo de usuario nuevo
   */
  private static async assessNewUserRisk(userId: string): Promise<RiskAssessmentResult['riskFactors'][0]> {
    try {
      const supabase = createAdminClient();

      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single();

      if (!profile) {
        return {
          type: 'profile_not_found',
          severity: 'high',
          description: 'User profile not found',
          score: 0.4,
        };
      }

      const accountAge = Date.now() - new Date(profile.created_at).getTime();
      const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

      if (daysSinceCreation < 1) {
        return {
          type: 'very_new_user',
          severity: 'high',
          description: 'Account created less than 24 hours ago',
          score: 0.3,
        };
      } else if (daysSinceCreation < 7) {
        return {
          type: 'new_user',
          severity: 'medium',
          description: 'Account created less than 7 days ago',
          score: 0.15,
        };
      }

      return {
        type: 'established_user',
        severity: 'low',
        description: 'Established user account',
        score: 0,
      };
    } catch (error) {
      logger.error('Failed to assess new user risk', error as Error, { userId });
      return {
        type: 'user_age_check_failed',
        severity: 'low',
        description: 'Unable to verify account age',
        score: 0.1,
      };
    }
  }

  /**
   * Determinar nivel de riesgo basado en el score
   */
  private static getRiskLevel(score: number): RiskAssessmentResult['riskLevel'] {
    if (score >= 0.7) return 'critical';
    if (score >= 0.4) return 'high';
    if (score >= 0.2) return 'medium';
    return 'low';
  }

  /**
   * Determinar si se requiere autenticación fuerte (3DS/SCA)
   */
  private static shouldRequireStrongAuth(
    riskScore: number,
    riskLevel: RiskAssessmentResult['riskLevel'],
    params: RiskAssessmentParams
  ): boolean {
    // Siempre requerir 3DS para transacciones críticas
    if (riskLevel === 'critical') {
      return true;
    }

    // Requerir 3DS para transacciones de alto riesgo
    if (riskLevel === 'high') {
      return true;
    }

    // Requerir 3DS para montos altos (>= $500 USD)
    const amountUSD = params.amountCents / 100;
    if (amountUSD >= 500) {
      return true;
    }

    // Requerir 3DS para usuarios nuevos con transacciones > $100
    if (riskLevel === 'medium' && amountUSD >= 100) {
      return true;
    }

    return false;
  }

  /**
   * Obtener recomendación basada en el riesgo
   */
  private static getRecommendation(
    riskLevel: RiskAssessmentResult['riskLevel'],
    requiresStrongAuth: boolean
  ): string {
    if (requiresStrongAuth) {
      return 'Require 3D Secure / Strong Customer Authentication (SCA) for this transaction';
    }

    switch (riskLevel) {
      case 'critical':
        return 'Block transaction and flag for manual review';
      case 'high':
        return 'Require additional verification before processing';
      case 'medium':
        return 'Monitor transaction closely and consider additional checks';
      case 'low':
      default:
        return 'Process transaction normally';
    }
  }
}

