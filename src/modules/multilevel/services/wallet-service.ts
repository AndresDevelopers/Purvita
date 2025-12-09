import type { SupabaseClient } from '@supabase/supabase-js';
import { WalletRepository } from '../repositories/wallet-repository';
import type { WalletReason } from '../domain/types';

export class WalletService {
  private readonly wallets: WalletRepository;

  constructor(private readonly client: SupabaseClient) {
    this.wallets = new WalletRepository(client);
  }

  async listTransactions(userId: string, limit = 50) {
    return this.wallets.listTransactions(userId, limit);
  }

  async getBalance(userId: string) {
    return this.wallets.findByUserId(userId);
  }

  /**
   * Add funds to a user's wallet (admin only)
   * @param userId - Target user ID
   * @param amountCents - Amount in cents (positive to add, negative to deduct)
   * @param reason - Reason for the transaction
   * @param adminId - ID of the admin performing the action
   * @param note - Optional note for the transaction
   */
  async addFunds(
    userId: string,
    amountCents: number,
    reason: WalletReason | 'admin_adjustment',
    adminId?: string,
    note?: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const meta: Record<string, unknown> = {
      ...metadata,
      timestamp: new Date().toISOString(),
    };

    if (adminId) {
      meta.admin_id = adminId;
    }

    if (note) {
      meta.note = note;
    }

    await this.wallets.addTransaction(userId, amountCents, reason, meta);
  }

  async recordRecharge(params: {
    userId: string;
    amountCents: number;
    gateway: 'stripe' | 'paypal';
    gatewayRef: string;
    currency?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ alreadyProcessed: boolean } | void> {
    const { userId, amountCents, gateway, gatewayRef, currency, metadata } = params;

    if (!gatewayRef) {
      throw new Error('Missing gateway reference');
    }

    if (amountCents <= 0) {
      return { alreadyProcessed: true };
    }

    const exists = await this.wallets.hasTransactionWithReference(userId, gatewayRef);
    if (exists) {
      return { alreadyProcessed: true };
    }

    const meta: Record<string, unknown> = {
      intent: 'wallet_recharge',
      gateway,
      external_reference: gatewayRef,
      currency: currency ?? 'USD',
      ...metadata,
      timestamp: new Date().toISOString(),
    };

    await this.wallets.addTransaction(userId, amountCents, 'recharge', meta);

    return { alreadyProcessed: false };
  }

  /**
   * Spend funds from wallet with atomic balance check
   * Uses database-level locking to prevent race conditions and double-spending
   */
  async spendFunds(
    userId: string,
    amountCents: number,
    meta: Record<string, unknown> = {},
  ): Promise<{ transactionId: string; newBalanceCents: number }> {
    console.log(`[WalletService] spendFunds called for user ${userId}, amount: ${amountCents} cents`);

    if (amountCents <= 0) {
      console.error(`[WalletService] Invalid amount: ${amountCents}`);
      throw new Error('Amount must be greater than zero');
    }

    const enrichedMeta: Record<string, unknown> = {
      ...meta,
      timestamp: new Date().toISOString(),
    };

    console.log(`[WalletService] Processing atomic debit for user ${userId}, amount: ${amountCents} cents`);

    try {
      // Use atomic debit function to prevent race conditions
      const result = await this.wallets.debitWithCheck(userId, amountCents, 'purchase', enrichedMeta);
      console.log(`[WalletService] Transaction completed successfully for user ${userId}`);

      return {
        transactionId: result.transactionId,
        newBalanceCents: result.newBalanceCents,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INSUFFICIENT_BALANCE') {
          console.error(`[WalletService] Insufficient balance for user ${userId}`);
          throw new Error('Insufficient wallet balance');
        }
        if (error.message === 'WALLET_NOT_FOUND') {
          console.error(`[WalletService] Wallet not found for user ${userId}`);
          throw new Error('Wallet not found');
        }
      }
      console.error(`[WalletService] Transaction failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get withdrawal statistics for a user
   */
  async getWithdrawalStats(userId: string, dailyLimitCents?: number) {
    return this.wallets.getWithdrawalStats(userId, dailyLimitCents);
  }

  /**
   * Check for fraud indicators
   */
  async checkFraudIndicators(userId: string) {
    return this.wallets.checkFraudIndicators(userId);
  }
}
