export type PaymentMethodType = 'card' | 'bank_account';
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'unknown';
export type CardFunding = 'credit' | 'debit' | 'prepaid' | 'unknown';

export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  type: PaymentMethodType;
  
  // Card details
  card_brand: CardBrand | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  card_funding: CardFunding | null;
  
  // Bank account details
  bank_name: string | null;
  bank_last4: string | null;
  
  is_default: boolean;
  
  // Metadata
  billing_name: string | null;
  billing_email: string | null;
  billing_address: Record<string, unknown>;
  
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentMethodInput {
  stripe_payment_method_id: string;
  type: PaymentMethodType;
  card_brand?: CardBrand;
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  card_funding?: CardFunding;
  billing_name?: string;
  billing_email?: string;
  billing_address?: Record<string, unknown>;
  is_default?: boolean;
}

export interface StripeCardDetails {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  funding: string;
}
