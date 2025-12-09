/**
 * Transaction Limits Service
 *
 * Manages daily transaction limits per user to prevent fraud and abuse.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

interface TransactionLimits {
  dailyTransactionLimit: number; // Max number of transactions per day
  dailyAmountLimitCents: number; // Max total amount per day in cents
}

interface TransactionCheck {
  allowed: boolean;
  reason?: string;
  currentTransactions?: number;
  currentAmountCents?: number;
  limits: TransactionLimits;
}

export class TransactionLimitsService {
  // Default limits (can be customized per user or globally)
  private static readonly DEFAULT_LIMITS: TransactionLimits = {
    dailyTransactionLimit: 10, // Max 10 transactions per day
    dailyAmountLimitCents: 50000000, // Max $500,000 per day
  };

  /**
   * Get transaction limits for a user
   * Can be customized per user from database or use defaults
   */
  static async getLimits(userId: string): Promise<TransactionLimits> {
    try {
      const supabase = await createAdminClient();

      // Check if user has custom limits
      const { data: userLimits } = await supabase
        .from('user_transaction_limits')
        .select('daily_transaction_limit, daily_amount_limit_cents')
        .eq('user_id', userId)
        .maybeSingle();

      if (userLimits) {
        return {
          dailyTransactionLimit: userLimits.daily_transaction_limit,
          dailyAmountLimitCents: userLimits.daily_amount_limit_cents,
        };
      }

      return this.DEFAULT_LIMITS;
    } catch (error) {
      logger.error('Failed to get transaction limits', error as Error, { userId });
      return this.DEFAULT_LIMITS;
    }
  }

  /**
   * Get today's transactions for a user
   */
  static async getTodayTransactions(userId: string): Promise<{
    count: number;
    totalAmountCents: number;
  }> {
    try {
      const supabase = await createAdminClient();

      // Get start of today in UTC
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Count transactions from orders table
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_cents')
        .eq('user_id', userId)
        .gte('created_at', todayISO)
        .in('status', ['paid', 'processing', 'completed']);

      if (error) {
        logger.error('Failed to get today transactions', error as Error, { userId });
        return { count: 0, totalAmountCents: 0 };
      }

      const count = orders?.length || 0;
      const totalAmountCents = orders?.reduce((sum, order) => sum + order.total_cents, 0) || 0;

      return { count, totalAmountCents };
    } catch (error) {
      logger.error('Failed to get today transactions', error as Error, { userId });
      return { count: 0, totalAmountCents: 0 };
    }
  }

  /**
   * Check if a transaction is allowed based on limits
   */
  static async checkTransactionAllowed(
    userId: string,
    amountCents: number
  ): Promise<TransactionCheck> {
    try {
      const limits = await this.getLimits(userId);
      const today = await this.getTodayTransactions(userId);

      // Check transaction count limit
      if (today.count >= limits.dailyTransactionLimit) {
        logger.security('Daily transaction limit exceeded', {
          userId,
          currentTransactions: today.count,
          limit: limits.dailyTransactionLimit,
        });

        return {
          allowed: false,
          reason: `Daily transaction limit reached (${limits.dailyTransactionLimit} transactions)`,
          currentTransactions: today.count,
          currentAmountCents: today.totalAmountCents,
          limits,
        };
      }

      // Check amount limit
      const newTotalAmount = today.totalAmountCents + amountCents;
      if (newTotalAmount > limits.dailyAmountLimitCents) {
        logger.security('Daily amount limit exceeded', {
          userId,
          currentAmount: today.totalAmountCents,
          requestedAmount: amountCents,
          newTotal: newTotalAmount,
          limit: limits.dailyAmountLimitCents,
        });

        return {
          allowed: false,
          reason: `Daily amount limit would be exceeded ($${(limits.dailyAmountLimitCents / 100).toFixed(2)})`,
          currentTransactions: today.count,
          currentAmountCents: today.totalAmountCents,
          limits,
        };
      }

      // Transaction is allowed
      return {
        allowed: true,
        currentTransactions: today.count,
        currentAmountCents: today.totalAmountCents,
        limits,
      };
    } catch (error) {
      logger.error('Failed to check transaction limits', error as Error, { userId, amountCents });

      // On error, allow transaction but log it
      return {
        allowed: true,
        limits: this.DEFAULT_LIMITS,
      };
    }
  }

  /**
   * Set custom limits for a user (admin only)
   */
  static async setUserLimits(
    userId: string,
    limits: TransactionLimits,
    adminId: string
  ): Promise<void> {
    try {
      const supabase = await createAdminClient();

      const { error } = await supabase
        .from('user_transaction_limits')
        .upsert({
          user_id: userId,
          daily_transaction_limit: limits.dailyTransactionLimit,
          daily_amount_limit_cents: limits.dailyAmountLimitCents,
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      logger.info('Transaction limits updated', {
        userId,
        adminId,
        limits,
      });
    } catch (error) {
      logger.error('Failed to set transaction limits', error as Error, { userId, limits, adminId });
      throw error;
    }
  }

  /**
   * Get warning threshold (80% of limit)
   */
  static getWarningThreshold(limits: TransactionLimits): {
    transactionWarning: number;
    amountWarningCents: number;
  } {
    return {
      transactionWarning: Math.floor(limits.dailyTransactionLimit * 0.8),
      amountWarningCents: Math.floor(limits.dailyAmountLimitCents * 0.8),
    };
  }

  /**
   * Check if user is approaching limits (for warnings)
   */
  static async isApproachingLimit(userId: string): Promise<boolean> {
    try {
      const limits = await this.getLimits(userId);
      const today = await this.getTodayTransactions(userId);
      const warnings = this.getWarningThreshold(limits);

      const approachingCount = today.count >= warnings.transactionWarning;
      const approachingAmount = today.totalAmountCents >= warnings.amountWarningCents;

      if (approachingCount || approachingAmount) {
        logger.warn('User approaching transaction limits', {
          userId,
          currentTransactions: today.count,
          transactionLimit: limits.dailyTransactionLimit,
          currentAmount: today.totalAmountCents,
          amountLimit: limits.dailyAmountLimitCents,
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check if approaching limit', error as Error, { userId });
      return false;
    }
  }
}
