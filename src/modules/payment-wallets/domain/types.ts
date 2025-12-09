export type PaymentProvider =
  | 'usdt_trc20'
  | 'usdt_erc20'
  | 'bitcoin'
  | 'ethereum'
  | 'paypal'
  | 'stripe'
  | 'bank_transfer'
  | 'zelle'
  | 'cash_app'
  | 'venmo'
  | 'western_union'
  | 'moneygram';

export type PaymentRequestStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'rejected' 
  | 'expired';

export interface PaymentWallet {
  id: string;
  provider: PaymentProvider;
  wallet_address: string | null;
  wallet_name: string | null;
  is_active: boolean;
  min_amount_cents: number;
  max_amount_cents: number;
  instructions: Record<string, string>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequest {
  id: string;
  user_id: string;
  wallet_id: string;
  amount_cents: number;
  status: PaymentRequestStatus;
  payment_proof_url: string | null;
  transaction_hash: string | null;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequestWithWallet extends PaymentRequest {
  wallet: PaymentWallet;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}
