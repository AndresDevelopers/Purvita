/**
 * Fraud Detection ML Service
 *
 * Preparación de infraestructura para Machine Learning en detección de fraude.
 *
 * Este servicio proporciona:
 * 1. Exportación de datos de entrenamiento
 * 2. Feature engineering para ML
 * 3. Integración preparada para modelos externos (AWS Fraud Detector, Sift, etc.)
 *
 * Para implementación completa de ML:
 * - Usar AWS Fraud Detector, Google Cloud Vertex AI, o Sift
 * - O entrenar modelos propios con TensorFlow.js/Python
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

interface FraudFeatures {
  // User features
  accountAgeDays: number;
  totalTransactions: number;
  totalSpentCents: number;
  averageTransactionCents: number;

  // Behavioral features
  transactionsLast24h: number;
  transactionsLast7d: number;
  uniqueIpsLast30d: number;
  uniqueDevicesLast30d: number;
  uniqueCountriesLast30d: number;

  // Risk indicators
  hasVpnUsage: boolean;
  hasRapidTransactions: boolean;
  hasMultipleAccounts: boolean;
  chargebackHistory: number;

  // Current transaction features
  transactionAmountCents: number;
  transactionHourOfDay: number;
  transactionDayOfWeek: number;
  isFirstTransaction: boolean;
  timeSinceLastTransactionMinutes: number;
}

export class FraudMLService {
  /**
   * Extract features for ML model
   */
  public static async extractFeatures(userId: string, transactionAmountCents: number): Promise<FraudFeatures> {
    const supabase = createAdminClient();

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single();

    const accountAgeDays = profile
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Get transaction history
    const { data: transactions } = await supabase
      .from('wallet_txns')
      .select('delta_cents, created_at, ip_address_encrypted, device_fingerprint, country_code')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000);

    const totalTransactions = transactions?.length || 0;
    const totalSpent = transactions
      ?.filter(t => t.delta_cents < 0)
      .reduce((sum, t) => sum + Math.abs(t.delta_cents), 0) || 0;

    const averageTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

    // Last 24 hours
    const last24h = transactions?.filter(t =>
      new Date(t.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) || [];

    // Last 7 days
    const last7d = transactions?.filter(t =>
      new Date(t.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ) || [];

    // Last 30 days
    const last30d = transactions?.filter(t =>
      new Date(t.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ) || [];

    const uniqueIps = new Set(last30d.filter(t => t.ip_address_encrypted).map(t => t.ip_address_encrypted)).size;
    const uniqueDevices = new Set(last30d.filter(t => t.device_fingerprint).map(t => t.device_fingerprint)).size;
    const uniqueCountries = new Set(last30d.filter(t => t.country_code).map(t => t.country_code)).size;

    // Check for rapid transactions
    const hasRapidTransactions = last24h.length >= 5;

    // Time since last transaction
    const lastTransaction = transactions?.[0];
    const timeSinceLastMinutes = lastTransaction
      ? Math.floor((Date.now() - new Date(lastTransaction.created_at).getTime()) / (1000 * 60))
      : 9999;

    const now = new Date();

    return {
      accountAgeDays,
      totalTransactions,
      totalSpentCents: totalSpent,
      averageTransactionCents: averageTransaction,
      transactionsLast24h: last24h.length,
      transactionsLast7d: last7d.length,
      uniqueIpsLast30d: uniqueIps,
      uniqueDevicesLast30d: uniqueDevices,
      uniqueCountriesLast30d: uniqueCountries,
      hasVpnUsage: false, // Would need to check geolocation cache
      hasRapidTransactions,
      hasMultipleAccounts: uniqueDevices > 3, // Heuristic
      chargebackHistory: 0, // Would need chargebacks table
      transactionAmountCents,
      transactionHourOfDay: now.getHours(),
      transactionDayOfWeek: now.getDay(),
      isFirstTransaction: totalTransactions === 0,
      timeSinceLastTransactionMinutes: timeSinceLastMinutes,
    };
  }

  /**
   * Export training data for ML model
   * Returns labeled examples for supervised learning
   */
  public static async exportTrainingData(limitDays: number = 90): Promise<{
    features: FraudFeatures[];
    labels: boolean[]; // true = fraud, false = legitimate
  }> {
    const supabase = createAdminClient();

    const since = new Date();
    since.setDate(since.getDate() - limitDays);

    // Get fraud alerts (labeled as fraud)
    const { data: fraudAlerts } = await supabase
      .from('wallet_fraud_alerts')
      .select('user_id, fraud_stats')
      .gte('created_at', since.toISOString())
      .eq('status', 'confirmed_fraud');

    // Get normal transactions (labeled as legitimate)
    const { data: normalTransactions } = await supabase
      .from('wallet_txns')
      .select('user_id, delta_cents')
      .gte('created_at', since.toISOString())
      .limit(1000);

    const features: FraudFeatures[] = [];
    const labels: boolean[] = [];

    // Process fraud cases
    if (fraudAlerts) {
      for (const alert of fraudAlerts) {
        try {
          const extracted = await this.extractFeatures(alert.user_id, 0);
          features.push(extracted);
          labels.push(true); // Fraud
        } catch (error) {
          logger.error('Failed to extract features for fraud alert', error as Error, { userId: alert.user_id });
        }
      }
    }

    // Process normal cases
    if (normalTransactions) {
      const sampleSize = Math.min(fraudAlerts?.length || 100, normalTransactions.length);
      const sampled = normalTransactions.slice(0, sampleSize);

      for (const txn of sampled) {
        try {
          const extracted = await this.extractFeatures(txn.user_id, Math.abs(txn.delta_cents));
          features.push(extracted);
          labels.push(false); // Legitimate
        } catch (error) {
          logger.error('Failed to extract features for normal transaction', error as Error);
        }
      }
    }

    logger.info('Training data exported', {
      totalSamples: features.length,
      fraudSamples: labels.filter(l => l).length,
      legitimateSamples: labels.filter(l => !l).length,
    });

    return { features, labels };
  }

  /**
   * Predict fraud probability using external ML service
   * Placeholder for AWS Fraud Detector, Sift, or custom model
   */
  public static async predictFraudProbability(features: FraudFeatures): Promise<{
    probability: number; // 0-1
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    // TODO: Integrate with AWS Fraud Detector, Sift, or custom TensorFlow model

    // Placeholder: Simple heuristic-based scoring
    let score = 0;

    if (features.isFirstTransaction) score += 0.2;
    if (features.hasRapidTransactions) score += 0.3;
    if (features.uniqueDevicesLast30d >= 3) score += 0.2;
    if (features.uniqueCountriesLast30d >= 3) score += 0.25;
    if (features.transactionAmountCents > 1000000) score += 0.15; // > $10,000
    if (features.accountAgeDays < 7) score += 0.15;

    const probability = Math.min(score, 1.0);

    const riskLevel =
      probability >= 0.8 ? 'critical' :
      probability >= 0.5 ? 'high' :
      probability >= 0.3 ? 'medium' :
      'low';

    return { probability, riskLevel };
  }

  /**
   * Integration with AWS Fraud Detector (example)
   */
  public static async callAWSFraudDetector(_features: FraudFeatures): Promise<number> {
    // Example integration - requires AWS SDK
    // npm install @aws-sdk/client-frauddetector

    /*
    import { FraudDetectorClient, GetEventPredictionCommand } from '@aws-sdk/client-frauddetector';

    const client = new FraudDetectorClient({ region: 'us-east-1' });

    const command = new GetEventPredictionCommand({
      detectorId: 'your-detector-id',
      detectorVersionId: '1',
      eventId: `txn-${Date.now()}`,
      eventTypeName: 'payment_fraud',
      entities: [{ entityType: 'customer', entityId: userId }],
      eventTimestamp: new Date().toISOString(),
      eventVariables: {
        accountAge: features.accountAgeDays.toString(),
        transactionAmount: features.transactionAmountCents.toString(),
        uniqueIps: features.uniqueIpsLast30d.toString(),
        // ... more features
      },
    });

    const response = await client.send(command);
    const fraudPrediction = response.modelScores?.[0]?.scores?.['fraud_probability'];

    return fraudPrediction || 0;
    */

    logger.warn('AWS Fraud Detector not configured');
    return 0;
  }
}
