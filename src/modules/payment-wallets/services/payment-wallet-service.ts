import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentWalletRepository } from '../repositories/payment-wallet-repository';
import { PaymentRequestRepository } from '../repositories/payment-request-repository';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import type { PaymentWallet, PaymentRequest, PaymentRequestStatus } from '../domain/types';
import { logUserAction } from '@/lib/services/audit-log-service';

export class PaymentWalletService {
  private readonly wallets: PaymentWalletRepository;
  private readonly requests: PaymentRequestRepository;
  private readonly userWalletService: WalletService;

  constructor(private readonly client: SupabaseClient) {
    this.wallets = new PaymentWalletRepository(client);
    this.requests = new PaymentRequestRepository(client);
    this.userWalletService = new WalletService(client);
  }

  // Wallet Management (Admin)
  async getActiveWallets() {
    return this.wallets.findActive();
  }

  async getAllWallets() {
    return this.wallets.findAll();
  }

  async getWalletById(id: string) {
    return this.wallets.findById(id);
  }

  async updateWallet(id: string, updates: Partial<PaymentWallet>) {
    return this.wallets.update(id, updates);
  }

  async createWallet(wallet: Partial<PaymentWallet>) {
    return this.wallets.create(wallet);
  }

  async deleteWallet(id: string) {
    return this.wallets.delete(id);
  }

  // Payment Request Management (User)
  async createPaymentRequest(
    userId: string,
    walletId: string,
    amountCents: number
  ): Promise<PaymentRequest> {
    // Validate wallet exists and is active
    const wallet = await this.wallets.findById(walletId);
    if (!wallet) {
      throw new Error('Payment wallet not found');
    }

    if (!wallet.is_active) {
      throw new Error('Payment wallet is not active');
    }

    // Validate amount
    if (amountCents < wallet.min_amount_cents) {
      throw new Error(`Minimum amount is ${wallet.min_amount_cents / 100} USD`);
    }

    if (amountCents > wallet.max_amount_cents) {
      throw new Error(`Maximum amount is ${wallet.max_amount_cents / 100} USD`);
    }

    // ✅ SECURITY: Check withdrawal limits (daily, monthly, single transaction)
    const { data: limitCheck, error: limitError } = await this.client.rpc('check_withdrawal_limits', {
      p_user_id: userId,
      p_amount_cents: amountCents,
    });

    if (limitError) {
      console.error('[PaymentWalletService] Failed to check withdrawal limits:', limitError);
      throw new Error('Failed to verify withdrawal limits');
    }

    if (!limitCheck?.allowed) {
      const reason = limitCheck?.reason || 'UNKNOWN';
      const limitCents = limitCheck?.limit_cents;
      const usedCents = limitCheck?.used_today_cents || limitCheck?.used_month_cents;
      const remainingCents = limitCheck?.remaining_cents;

      let errorMessage = 'Withdrawal limit exceeded';

      if (reason === 'EXCEEDS_SINGLE_TRANSACTION_LIMIT') {
        errorMessage = `Single transaction limit exceeded. Maximum: $${(limitCents / 100).toFixed(2)}`;
      } else if (reason === 'EXCEEDS_DAILY_LIMIT') {
        errorMessage = `Daily withdrawal limit exceeded. Used today: $${(usedCents / 100).toFixed(2)}, Remaining: $${(remainingCents / 100).toFixed(2)}`;
      } else if (reason === 'EXCEEDS_MONTHLY_LIMIT') {
        errorMessage = `Monthly withdrawal limit exceeded. Used this month: $${(usedCents / 100).toFixed(2)}, Remaining: $${(remainingCents / 100).toFixed(2)}`;
      }

      // Log security event for limit violation
      await logUserAction(
        'WITHDRAWAL_LIMIT_EXCEEDED',
        'payment_request',
        undefined,
        {
          userId,
          reason,
          requested_cents: amountCents,
          limit_cents: limitCents,
          used_cents: usedCents,
          remaining_cents: remainingCents,
        }
      );

      throw new Error(errorMessage);
    }

    // Check for existing pending request
    const userRequests = await this.requests.findByUserId(userId, 1);
    const hasPending = userRequests.some((req) => req.status === 'pending');

    if (hasPending) {
      throw new Error('You already have a pending payment request');
    }

    // Create request with 24h expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.requests.create({
      user_id: userId,
      wallet_id: walletId,
      amount_cents: amountCents,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    });
  }

  async getUserPaymentRequests(userId: string) {
    return this.requests.findByUserId(userId);
  }

  async updatePaymentProof(
    requestId: string,
    userId: string,
    proofUrl: string,
    transactionHash?: string
  ) {
    const request = await this.requests.findById(requestId);
    
    if (!request) {
      throw new Error('Payment request not found');
    }

    if (request.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    if (request.status !== 'pending') {
      throw new Error('Cannot update proof for non-pending request');
    }

    return this.requests.update(requestId, {
      payment_proof_url: proofUrl,
      transaction_hash: transactionHash,
      status: 'processing',
    });
  }

  // Admin Functions
  async getAllPaymentRequests(limit = 100) {
    return this.requests.findAll(limit);
  }

  async getPaymentRequestsByStatus(status: PaymentRequestStatus) {
    return this.requests.findByStatus(status);
  }

  async approvePaymentRequest(
    requestId: string,
    adminId: string,
    adminNotes?: string
  ) {
    const request = await this.requests.findById(requestId);
    
    if (!request) {
      throw new Error('Payment request not found');
    }

    if (request.status !== 'processing' && request.status !== 'pending') {
      throw new Error('Can only approve processing or pending requests');
    }

    // Add funds to user wallet
    await this.userWalletService.addFunds(
      request.user_id,
      request.amount_cents,
      'admin_adjustment',
      adminId,
      `Balance recharge approved: ${adminNotes || 'Payment verified'}`
    );

    // Log audit trail for wallet recharge
    try {
      await logUserAction('WALLET_RECHARGED', 'wallet', request.user_id, {
        amountCents: request.amount_cents,
        requestId,
        approvedBy: adminId,
        notes: adminNotes,
      });
    } catch (auditError) {
      console.warn('[PaymentWalletService] Failed to log wallet recharge audit:', auditError);
    }

    // Update request status
    return this.requests.updateStatus(requestId, 'completed', adminId, adminNotes);
  }

  async rejectPaymentRequest(
    requestId: string,
    adminId: string,
    reason: string
  ) {
    const request = await this.requests.findById(requestId);
    
    if (!request) {
      throw new Error('Payment request not found');
    }

    if (request.status === 'completed') {
      throw new Error('Cannot reject completed request');
    }

    return this.requests.updateStatus(requestId, 'rejected', adminId, reason);
  }
}
