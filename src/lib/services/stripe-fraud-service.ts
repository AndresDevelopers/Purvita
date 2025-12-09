/**
 * Stripe Fraud Service
 *
 * Procesa eventos de fraude de Stripe Radar y crea alertas en el sistema.
 *
 * Eventos soportados:
 * - charge.dispute.created: Disputa creada por el cliente
 * - charge.dispute.updated: Disputa actualizada
 * - charge.dispute.closed: Disputa cerrada
 * - radar.early_fraud_warning.created: Advertencia temprana de fraude
 * - radar.early_fraud_warning.updated: Advertencia actualizada
 * - review.opened: Revisión de fraude abierta por Stripe
 * - review.closed: Revisión de fraude cerrada
 * - charge.failed: Cargo fallido (puede indicar fraude)
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type _Stripe from 'stripe';

interface StripeFraudEvent {
  type: string;
  data: {
    object: any;
  };
  created: number;
}

interface FraudAlertData {
  userId?: string;
  stripeChargeId?: string;
  stripeCustomerId?: string;
  amountCents?: number;
  currency?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  fraudStats: {
    eventType: string;
    stripeEventId?: string;
    reason?: string;
    status?: string;
    ipAddress?: string;
    ipCountry?: string;
    cardCountry?: string;
    cvcCheck?: string;
    addressCheck?: string;
    zipCheck?: string;
    detectedAt: string;
    metadata?: Record<string, any>;
  };
}

export class StripeFraudService {
  /**
   * Procesar evento de disputa (chargeback)
   */
  static async processDispute(event: StripeFraudEvent): Promise<void> {
    const dispute = event.data.object as any;
    
    logger.info('Processing Stripe dispute', {
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    });

    // Obtener información del cargo
    const charge = await this.getChargeInfo(dispute.charge as string);
    if (!charge) {
      logger.warn('Charge not found for dispute', { chargeId: dispute.charge });
      return;
    }

    const userId = charge.metadata?.userId as string | undefined;
    if (!userId) {
      logger.warn('No userId in charge metadata', { chargeId: dispute.charge });
      return;
    }

    // Calcular risk score basado en el tipo de disputa
    const riskScore = this.calculateDisputeRiskScore(dispute);
    const riskLevel = this.getRiskLevel(riskScore);

    const alertData: FraudAlertData = {
      userId,
      stripeChargeId: dispute.charge as string,
      stripeCustomerId: charge.customer as string | undefined,
      amountCents: dispute.amount,
      currency: dispute.currency,
      riskScore,
      riskLevel,
      riskFactors: [
        {
          type: 'chargeback',
          severity: riskLevel,
          description: `Chargeback initiated: ${dispute.reason}`,
        },
      ],
      fraudStats: {
        eventType: event.type,
        stripeEventId: dispute.id,
        reason: dispute.reason,
        status: dispute.status,
        detectedAt: new Date(event.created * 1000).toISOString(),
        metadata: {
          disputeId: dispute.id,
          chargeId: dispute.charge,
          evidence: dispute.evidence,
        },
      },
    };

    await this.createFraudAlert(alertData);

    // Si es una disputa crítica, bloquear automáticamente al usuario
    if (riskLevel === 'critical') {
      await this.blockUser(userId, `Chargeback crítico: ${dispute.reason}`, {
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount: dispute.amount,
      });
    }
  }

  /**
   * Procesar advertencia temprana de fraude (Early Fraud Warning)
   */
  static async processEarlyFraudWarning(event: StripeFraudEvent): Promise<void> {
    const warning = event.data.object as any; // Stripe.Radar.EarlyFraudWarning
    
    logger.security('Stripe Early Fraud Warning detected', {
      warningId: warning.id,
      chargeId: warning.charge,
      fraudType: warning.fraud_type,
    });

    const charge = await this.getChargeInfo(warning.charge as string);
    if (!charge) {
      logger.warn('Charge not found for early fraud warning', { chargeId: warning.charge });
      return;
    }

    const userId = charge.metadata?.userId as string | undefined;
    if (!userId) {
      logger.warn('No userId in charge metadata', { chargeId: warning.charge });
      return;
    }

    // Early fraud warnings son críticas
    const riskScore = 0.95;
    const riskLevel = 'critical';

    const alertData: FraudAlertData = {
      userId,
      stripeChargeId: warning.charge as string,
      amountCents: charge.amount,
      currency: charge.currency,
      riskScore,
      riskLevel,
      riskFactors: [
        {
          type: 'early_fraud_warning',
          severity: 'critical',
          description: `Early fraud warning from card network: ${warning.fraud_type}`,
        },
      ],
      fraudStats: {
        eventType: event.type,
        stripeEventId: warning.id,
        reason: warning.fraud_type,
        detectedAt: new Date(event.created * 1000).toISOString(),
        metadata: {
          warningId: warning.id,
          chargeId: warning.charge,
          fraudType: warning.fraud_type,
        },
      },
    };

    await this.createFraudAlert(alertData);

    // Bloquear automáticamente - las early fraud warnings son muy confiables
    await this.blockUser(userId, `Early Fraud Warning: ${warning.fraud_type}`, {
      warningId: warning.id,
      chargeId: warning.charge,
      fraudType: warning.fraud_type,
    });
  }

  /**
   * Procesar revisión de Stripe Radar
   */
  static async processReview(event: StripeFraudEvent): Promise<void> {
    const review = event.data.object as any; // Stripe.Review
    
    logger.info('Processing Stripe Radar review', {
      reviewId: review.id,
      chargeId: review.charge,
      reason: review.reason,
      opened: review.opened,
    });

    if (!review.charge) {
      logger.warn('No charge associated with review', { reviewId: review.id });
      return;
    }

    const charge = await this.getChargeInfo(review.charge as string);
    if (!charge) {
      logger.warn('Charge not found for review', { chargeId: review.charge });
      return;
    }

    const userId = charge.metadata?.userId as string | undefined;
    if (!userId) {
      logger.warn('No userId in charge metadata', { chargeId: review.charge });
      return;
    }

    // Calcular risk score basado en la razón de la revisión
    const riskScore = this.calculateReviewRiskScore(review);
    const riskLevel = this.getRiskLevel(riskScore);

    const alertData: FraudAlertData = {
      userId,
      stripeChargeId: review.charge as string,
      amountCents: charge.amount,
      currency: charge.currency,
      riskScore,
      riskLevel,
      riskFactors: [
        {
          type: 'radar_review',
          severity: riskLevel,
          description: `Stripe Radar flagged transaction: ${review.reason}`,
        },
      ],
      fraudStats: {
        eventType: event.type,
        stripeEventId: review.id,
        reason: review.reason,
        status: review.opened ? 'open' : 'closed',
        ipAddress: review.ip_address || undefined,
        ipCountry: review.ip_address_location?.country || undefined,
        detectedAt: new Date(event.created * 1000).toISOString(),
        metadata: {
          reviewId: review.id,
          chargeId: review.charge,
          reason: review.reason,
          opened: review.opened,
        },
      },
    };

    await this.createFraudAlert(alertData);

    // Si la revisión está abierta y es de alto riesgo, bloquear temporalmente
    if (review.opened && riskLevel === 'high') {
      await this.blockUser(userId, `Stripe Radar review: ${review.reason}`, {
        reviewId: review.id,
        chargeId: review.charge,
        reason: review.reason,
      });
    }
  }

  /**
   * Procesar cargo fallido (puede indicar fraude)
   */
  static async processFailedCharge(event: StripeFraudEvent): Promise<void> {
    const charge = event.data.object as any; // Stripe.Charge
    
    // Solo procesar si el fallo parece ser fraude
    const fraudIndicators = ['card_declined', 'fraudulent', 'stolen_card', 'lost_card'];
    const failureCode = charge.failure_code || '';
    const failureMessage = charge.failure_message || '';
    
    const isFraudRelated = fraudIndicators.some(
      indicator => failureCode.includes(indicator) || failureMessage.toLowerCase().includes(indicator)
    );

    if (!isFraudRelated) {
      return; // No es fraude, solo un cargo fallido normal
    }

    logger.warn('Fraud-related charge failure detected', {
      chargeId: charge.id,
      failureCode,
      failureMessage,
    });

    const userId = charge.metadata?.userId as string | undefined;
    if (!userId) {
      return;
    }

    const riskScore = 0.7;
    const riskLevel = 'high';

    const alertData: FraudAlertData = {
      userId,
      stripeChargeId: charge.id,
      amountCents: charge.amount,
      currency: charge.currency,
      riskScore,
      riskLevel,
      riskFactors: [
        {
          type: 'failed_charge',
          severity: 'high',
          description: `Suspicious charge failure: ${failureCode}`,
        },
      ],
      fraudStats: {
        eventType: event.type,
        stripeEventId: charge.id,
        reason: failureCode,
        status: 'failed',
        detectedAt: new Date(event.created * 1000).toISOString(),
        metadata: {
          chargeId: charge.id,
          failureCode,
          failureMessage,
        },
      },
    };

    await this.createFraudAlert(alertData);
  }

  /**
   * Crear alerta de fraude en la base de datos
   */
  private static async createFraudAlert(data: FraudAlertData): Promise<void> {
    try {
      const supabase = createAdminClient();

      const { error } = await supabase
        .from('wallet_fraud_alerts')
        .insert({
          user_id: data.userId,
          risk_score: data.riskScore,
          risk_level: data.riskLevel,
          risk_factors: data.riskFactors,
          fraud_stats: data.fraudStats,
          status: 'pending',
        });

      if (error) {
        throw error;
      }

      logger.info('Stripe fraud alert created', {
        userId: data.userId,
        riskLevel: data.riskLevel,
        eventType: data.fraudStats.eventType,
      });
    } catch (error) {
      logger.error('Failed to create Stripe fraud alert', error as Error, {
        userId: data.userId,
      });
    }
  }

  /**
   * Bloquear usuario automáticamente
   */
  private static async blockUser(
    userId: string,
    reason: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const supabase = createAdminClient();

      const { error } = await supabase
        .from('user_blacklist')
        .insert({
          user_id: userId,
          reason,
          fraud_type: 'payment_fraud',
          notes: JSON.stringify({
            autoBlocked: true,
            source: 'stripe_radar',
            metadata,
            blockedAt: new Date().toISOString(),
          }),
          blocked_by: null, // Sistema automático
        });

      if (error) {
        // Si ya está bloqueado, ignorar el error
        if (error.code === '23505') {
          logger.info('User already blocked', { userId });
          return;
        }
        throw error;
      }

      logger.security('User auto-blocked by Stripe Radar', {
        userId,
        reason,
      });
    } catch (error) {
      logger.error('Failed to block user', error as Error, { userId });
    }
  }

  /**
   * Obtener información del cargo desde Stripe
   */
  private static async getChargeInfo(chargeId: string): Promise<any | null> { // Stripe.Charge
    try {
      // Importar dinámicamente para evitar problemas de inicialización
      const { GatewayCredentialsService } = await import('@/modules/payments/services/gateway-credentials-service');
      const Stripe = (await import('stripe')).default;

      const { credentials } = await GatewayCredentialsService.getActiveProviderCredentialsWithFallback('stripe');
      const stripe = new Stripe(credentials.secret_key, { apiVersion: '2024-12-18' });

      const charge = await (stripe as any).charges.retrieve(chargeId);
      return charge;
    } catch (error) {
      logger.error('Failed to get charge info', error as Error, { chargeId });
      return null;
    }
  }

  /**
   * Calcular risk score para disputas
   */
  private static calculateDisputeRiskScore(dispute: any): number { // Stripe.Dispute
    const highRiskReasons = ['fraudulent', 'unauthorized'];
    const mediumRiskReasons = ['product_not_received', 'product_unacceptable'];

    if (highRiskReasons.includes(dispute.reason)) {
      return 0.9;
    } else if (mediumRiskReasons.includes(dispute.reason)) {
      return 0.6;
    }
    return 0.4;
  }

  /**
   * Calcular risk score para revisiones
   */
  private static calculateReviewRiskScore(review: any): number { // Stripe.Review
    const highRiskReasons = ['rule', 'manual'];

    if (highRiskReasons.includes(review.reason)) {
      return 0.8;
    }
    return 0.5;
  }

  /**
   * Obtener nivel de riesgo basado en el score
   */
  private static getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }
}

