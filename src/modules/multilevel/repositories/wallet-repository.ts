import type { SupabaseClient } from '@supabase/supabase-js';
import type { WalletRecord, WalletReason } from '../domain/types';
import { randomUUID as _randomUUID } from 'crypto';

export class WalletRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: string) {
    const { data, error } = await this.client
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as WalletRecord | null;
  }

  async listTransactions(userId: string, limit = 50) {
    const { data, error } = await this.client
      .from('wallet_txns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async ensureWalletExists(userId: string): Promise<void> {
    const { error } = await this.client
      .from('wallets')
      .insert({ user_id: userId, balance_cents: 0 })
      .select()
      .single();

    // Ignore conflict errors (wallet already exists)
    if (error && error.code !== '23505') {
      throw error;
    }
  }

  /**
   * Add a wallet transaction atomically using database function
   * This prevents race conditions by using a single atomic database operation
   */
  async addTransaction(
    userId: string,
    deltaCents: number,
    reason: WalletReason | 'admin_adjustment',
    meta?: Record<string, unknown>
  ): Promise<{ transactionId: string; newBalanceCents: number }> {
    console.log(`[WalletRepository] Adding transaction for user ${userId}, delta: ${deltaCents}, reason: ${reason}`);

    try {
      // Use atomic database function to prevent race conditions
      // Convert to integer to match PostgreSQL function signature
      const { data, error } = await this.client.rpc('add_wallet_transaction', {
        p_user_id: userId,
        p_delta_cents: Math.floor(deltaCents),
        p_reason: reason,
        p_meta: (meta ?? {}) as unknown,
      });

      if (error) {
        console.error(`[WalletRepository] Transaction failed:`, error);
        throw error;
      }

      console.log(`[WalletRepository] Transaction completed successfully:`, data);

      return {
        transactionId: data.transaction_id,
        newBalanceCents: data.new_balance_cents,
      };
    } catch (error) {
      console.error(`[WalletRepository] Atomic transaction failed:`, error);
      throw error;
    }
  }

  /**
   * Debit wallet with atomic balance check
   * This prevents double-spending by locking the wallet row during the operation
   */
  async debitWithCheck(
    userId: string,
    amountCents: number,
    reason: WalletReason = 'purchase',
    meta?: Record<string, unknown>
  ): Promise<{ transactionId: string; newBalanceCents: number; previousBalanceCents: number }> {
    console.log(`[WalletRepository] Debiting ${amountCents} cents from user ${userId}`);

    try {
      const { data, error } = await this.client.rpc('debit_wallet_with_check', {
        p_user_id: userId,
        p_amount_cents: amountCents,
        p_reason: reason,
        p_meta: (meta ?? {}) as unknown,
      });

      if (error) {
        // Check for specific error types
        if (error.message?.includes('Insufficient balance')) {
          throw new Error('INSUFFICIENT_BALANCE');
        }
        if (error.message?.includes('Wallet not found')) {
          throw new Error('WALLET_NOT_FOUND');
        }
        throw error;
      }

      console.log(`[WalletRepository] Debit successful:`, data);

      return {
        transactionId: data.transaction_id,
        newBalanceCents: data.new_balance_cents,
        previousBalanceCents: data.previous_balance_cents,
      };
    } catch (error) {
      console.error(`[WalletRepository] Debit failed:`, error);
      throw error;
    }
  }

  /**
   * Get withdrawal statistics and check daily limits
   */
  async getWithdrawalStats(userId: string, dailyLimitCents: number = 50000000): Promise<{
    totalWithdrawn24hCents: number;
    dailyLimitCents: number;
    remainingLimitCents: number;
    currentBalanceCents: number;
    limitExceeded: boolean;
  }> {
    const { data, error } = await this.client.rpc('get_user_withdrawal_stats', {
      p_user_id: userId,
      p_daily_limit_cents: dailyLimitCents,
    });

    if (error) {
      throw error;
    }

    return {
      totalWithdrawn24hCents: data.total_withdrawn_24h_cents,
      dailyLimitCents: data.daily_limit_cents,
      remainingLimitCents: data.remaining_limit_cents,
      currentBalanceCents: data.current_balance_cents,
      limitExceeded: data.limit_exceeded,
    };
  }

  /**
   * Check for fraud indicators in wallet activity
   */
  async checkFraudIndicators(userId: string): Promise<{
    riskScore: number;
    riskLevel: 'minimal' | 'low' | 'medium' | 'high';
    riskFactors: unknown[];
    shouldFlagForReview: boolean;
    stats: unknown;
  }> {
    const { data, error } = await this.client.rpc('check_wallet_fraud_indicators', {
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    return {
      riskScore: data.risk_score,
      riskLevel: data.risk_level,
      riskFactors: data.risk_factors,
      shouldFlagForReview: data.should_flag_for_review,
      stats: data.stats,
    };
  }

  async sumTotalBalance() {
    const { data, error } = await this.client
      .from('wallets')
      .select('balance_cents');

    if (error) {
      throw error;
    }

    const total = (data ?? []).reduce((sum, wallet) => sum + (wallet.balance_cents ?? 0), 0);
    return total;
  }

  async hasTransactionWithReference(userId: string, reference: string) {
    if (!reference) {
      return false;
    }

    const { data, error } = await this.client
      .from('wallet_txns')
      .select('id')
      .eq('user_id', userId)
      .eq('meta->>external_reference', reference)
      .maybeSingle();

    if (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : null;
      if (code && code !== 'PGRST116') {
        throw error;
      }
      if (!code) {
        throw error;
      }
    }

    return Boolean(data);
  }
}
