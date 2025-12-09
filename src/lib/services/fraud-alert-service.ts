/**
 * Fraud Alert Service
 *
 * Envía alertas en tiempo real a administradores cuando se detecta
 * actividad fraudulenta de alto riesgo.
 *
 * Canales de notificación:
 * 1. Email a administradores
 * 2. Registro en tabla fraud_alerts
 * 3. Webhook opcional para sistemas externos
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { Resend } from 'resend';

interface FraudAlert {
  userId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: unknown[];
  stats: Record<string, any>;
  transactionDetails?: {
    amountCents?: number;
    currency?: string;
    type?: string;
  };
}

export class FraudAlertService {
  private static resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  /**
   * Obtener emails de administradores
   */
  private static async getAdminEmails(): Promise<string[]> {
    try {
      const supabase = createAdminClient();

      const { data: admins, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'admin')
        .eq('status', 'active');

      if (error || !admins) {
        logger.error('Failed to get admin emails', error as Error);
        return [];
      }

      return admins.map(admin => admin.email).filter(Boolean);
    } catch (error) {
      logger.error('Failed to fetch admin emails', error as Error);
      return [];
    }
  }

  /**
   * Obtener información del usuario para el email
   */
  private static async getUserInfo(userId: string): Promise<{
    name: string;
    email: string;
  }> {
    try {
      const supabase = createAdminClient();

      const { data: user } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', userId)
        .single();

      return {
        name: user?.name || 'Unknown User',
        email: user?.email || 'unknown@example.com',
      };
    } catch (_error) {
      return {
        name: 'Unknown User',
        email: 'unknown@example.com',
      };
    }
  }

  /**
   * Generar HTML para el email de alerta
   */
  private static generateAlertEmailHTML(alert: FraudAlert, userInfo: { name: string; email: string }): string {
    const riskColor = {
      low: '#FFA500',
      medium: '#FF6B00',
      high: '#FF0000',
      critical: '#8B0000',
    }[alert.riskLevel];

    const riskEmoji = {
      low: '⚠️',
      medium: '🚨',
      high: '🔴',
      critical: '🚫',
    }[alert.riskLevel];

    const factorsList = alert.riskFactors
      .map((factor: any) => `<li><strong>${factor.factor}</strong>: ${factor.description} (Severity: ${factor.severity})</li>`)
      .join('');

    const statsList = Object.entries(alert.stats)
      .map(([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`)
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${riskColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
    .alert-box { background: #fff; border-left: 4px solid ${riskColor}; padding: 15px; margin: 15px 0; }
    .score { font-size: 48px; font-weight: bold; color: ${riskColor}; text-align: center; margin: 20px 0; }
    .section { margin: 20px 0; }
    .section h3 { color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
    ul { list-style: none; padding: 0; }
    li { padding: 8px 0; border-bottom: 1px solid #eee; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    .btn { display: inline-block; padding: 12px 24px; background: ${riskColor}; color: white; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${riskEmoji} Fraud Alert - ${alert.riskLevel.toUpperCase()} Risk Detected</h1>
    </div>
    <div class="content">
      <div class="score">${alert.riskScore}</div>
      <p style="text-align: center; font-size: 18px; color: #666;">Risk Score</p>

      <div class="alert-box">
        <h2>🔍 User Information</h2>
        <ul>
          <li><strong>Name:</strong> ${userInfo.name}</li>
          <li><strong>Email:</strong> ${userInfo.email}</li>
          <li><strong>User ID:</strong> ${alert.userId}</li>
        </ul>
      </div>

      ${alert.transactionDetails ? `
      <div class="section">
        <h3>💰 Transaction Details</h3>
        <ul>
          <li><strong>Amount:</strong> $${((alert.transactionDetails.amountCents || 0) / 100).toFixed(2)} ${alert.transactionDetails.currency || 'USD'}</li>
          <li><strong>Type:</strong> ${alert.transactionDetails.type || 'Unknown'}</li>
        </ul>
      </div>
      ` : ''}

      <div class="section">
        <h3>🚨 Risk Factors</h3>
        <ul>
          ${factorsList}
        </ul>
      </div>

      <div class="section">
        <h3>📊 Statistics</h3>
        <ul>
          ${statsList}
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/users/details/${alert.userId}" class="btn">
          View User Profile
        </a>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/payment-requests?status=pending" class="btn">
          Review Pending Alerts
        </a>
      </div>

      <div class="footer">
        <p>This is an automated fraud detection alert from PūrVita.</p>
        <p>Alert generated at: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Enviar email de alerta a administradores
   */
  private static async sendEmailAlert(alert: FraudAlert, userInfo: { name: string; email: string }): Promise<void> {
    if (!this.resend) {
      logger.warn('Resend not configured, skipping email alert');
      return;
    }

    const adminEmails = await this.getAdminEmails();

    if (adminEmails.length === 0) {
      logger.warn('No admin emails found, cannot send alert');
      return;
    }

    try {
      const html = this.generateAlertEmailHTML(alert, userInfo);

      await this.resend.emails.send({
        from: process.env.CONTACT_FROM_EMAIL || 'alerts@purvita.com',
        to: adminEmails,
        subject: `🚨 ${alert.riskLevel.toUpperCase()} Risk Fraud Alert - Score: ${alert.riskScore}`,
        html,
      });

      logger.info('Fraud alert email sent', {
        recipients: adminEmails.length,
        riskLevel: alert.riskLevel,
        riskScore: alert.riskScore,
      });
    } catch (error) {
      logger.error('Failed to send fraud alert email', error as Error, {
        adminCount: adminEmails.length,
        userId: alert.userId,
      });
    }
  }

  /**
   * Registrar alerta en la base de datos
   */
  private static async createAlertRecord(alert: FraudAlert): Promise<void> {
    try {
      const supabase = createAdminClient();

      const { error } = await supabase
        .from('wallet_fraud_alerts')
        .insert({
          user_id: alert.userId,
          risk_score: alert.riskScore,
          risk_level: alert.riskLevel,
          risk_factors: alert.riskFactors,
          fraud_stats: alert.stats,
          status: 'pending',
        });

      if (error) {
        throw error;
      }

      logger.info('Fraud alert record created', {
        userId: alert.userId,
        riskScore: alert.riskScore,
      });
    } catch (error) {
      logger.error('Failed to create fraud alert record', error as Error, {
        userId: alert.userId,
      });
    }
  }

  /**
   * Enviar webhook a sistema externo (opcional)
   */
  private static async sendWebhookAlert(alert: FraudAlert): Promise<void> {
    const webhookUrl = process.env.FRAUD_ALERT_WEBHOOK_URL;

    if (!webhookUrl) {
      return; // Webhook no configurado
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': process.env.FRAUD_ALERT_WEBHOOK_SECRET || '',
        },
        body: JSON.stringify({
          event: 'fraud.alert.created',
          timestamp: new Date().toISOString(),
          data: alert,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      logger.info('Fraud alert webhook sent', { webhookUrl, userId: alert.userId });
    } catch (error) {
      logger.error('Failed to send fraud alert webhook', error as Error, {
        webhookUrl,
        userId: alert.userId,
      });
    }
  }

  /**
   * Método principal: Enviar alerta completa
   */
  public static async sendAlert(alert: FraudAlert): Promise<void> {
    logger.security('Fraud alert triggered', {
      userId: alert.userId,
      riskScore: alert.riskScore,
      riskLevel: alert.riskLevel,
    });

    // 1. Obtener información del usuario
    const userInfo = await this.getUserInfo(alert.userId);

    // 2. Registrar en base de datos
    await this.createAlertRecord(alert);

    // 3. Enviar email a admins (solo para high/critical)
    if (alert.riskLevel === 'high' || alert.riskLevel === 'critical') {
      await this.sendEmailAlert(alert, userInfo);
    }

    // 4. Enviar webhook si está configurado
    if (alert.riskLevel === 'critical') {
      await this.sendWebhookAlert(alert);
    }

    logger.info('Fraud alert processing completed', {
      userId: alert.userId,
      riskLevel: alert.riskLevel,
    });
  }

  /**
   * Método de conveniencia para alertas de transacciones bloqueadas
   */
  public static async sendBlockedTransactionAlert(params: {
    userId: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: unknown[];
    stats: Record<string, any>;
    amountCents?: number;
    currency?: string;
    type?: string;
  }): Promise<void> {
    await this.sendAlert({
      userId: params.userId,
      riskScore: params.riskScore,
      riskLevel: params.riskLevel,
      riskFactors: params.riskFactors,
      stats: params.stats,
      transactionDetails: {
        amountCents: params.amountCents,
        currency: params.currency,
        type: params.type,
      },
    });
  }
}
