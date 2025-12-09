export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'unpaid';
export type PaymentStatus = 'paid' | 'failed' | 'refunded';
export type PaymentKind = 'subscription' | 'order';
export type PaymentGateway = 'stripe' | 'paypal' | 'wallet';
export type WalletReason = 'phase_bonus' | 'withdrawal' | 'sale_commission' | 'purchase' | 'recharge';

export type SubscriptionType = 'mlm' | 'affiliate';

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan_id: string | null;
  subscription_type: SubscriptionType;
  status: SubscriptionStatus;
  current_period_end: string | null;
  gateway: PaymentGateway;
  cancel_at_period_end: boolean;
  default_payment_method_id: string | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  kind: PaymentKind;
  gateway: PaymentGateway;
  gateway_ref: string;
  period_end: string | null;
  created_at: string;
  archived: boolean;
}

export interface PhaseRecord {
  user_id: string;
  phase: number;
  ecommerce_commission: number;
  phase1_granted: boolean;
  phase2_granted: boolean;
  phase3_granted: boolean;
  phase2_achieved_at: string | null;
  updated_at: string;
}

export interface WalletRecord {
  user_id: string;
  balance_cents: number;
}

export interface TreeMember {
  id: string;
  email: string;
  name: string | null;
  status: SubscriptionStatus | null;
  level: number; // Changed from 1 | 2 to support dynamic levels
  phase: number | null;
  allowTeamMessages?: boolean; // Privacy setting: allow team members to send messages
}

export type NetworkMemberStatus = 'active' | 'inactive';

export interface NetworkMember extends TreeMember {
  statusCategory: NetworkMemberStatus;
}

export interface NetworkLevelSnapshot {
  level: number; // Changed from 1 | 2 to support dynamic levels
  total: number;
  active: number;
  inactive: number;
}

// New type for multilevel tree response
export interface MultilevelTreeResponse {
  levels: Record<number, TreeMember[]>; // Dynamic levels: { 1: [...], 2: [...], 3: [...], etc }
  maxLevel: number;
}

// Legacy type for backward compatibility
export interface TwoLevelTreeResponse {
  level1: TreeMember[];
  level2: TreeMember[];
}

export interface NetworkOverview {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  levels: NetworkLevelSnapshot[];
  members: NetworkMember[];
}

export interface SubscriptionSummary {
  phase: PhaseRecord | null;
  subscription: SubscriptionRecord | null;
  wallet: WalletRecord | null;
  level1Count: number;
  level2Count: number;
  network: NetworkOverview;
}
