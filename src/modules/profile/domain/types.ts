import type { PhaseRecord, SubscriptionRecord, WalletRecord } from '@/modules/multilevel/domain/types';

export interface NetworkEarningsMember {
  memberId: string;
  memberName: string | null;
  memberEmail: string | null;
  totalCents: number;
}

export interface NetworkEarningsSnapshot {
  totalAvailableCents: number;
  currency: string;
  members: NetworkEarningsMember[];
}

export interface PayoutAccountSnapshot {
  provider: 'stripe' | 'paypal' | 'authorize_net' | 'payoneer';
  status: 'pending' | 'active' | 'restricted' | 'disabled';
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorInfo {
  id: string;
  name: string | null;
  email: string | null;
}

export interface ProfileContactInfo {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  fulfillment_company?: string | null;
}

export interface MembershipSnapshot {
  phase: PhaseRecord | null;
  subscription: SubscriptionRecord | null;
  sponsor: SponsorInfo | null;
  joinDate: string | null;
  referralCode: string | null;
}

export interface OrderItemSummary {
  product_id: string | null;
  name: string | null;
  qty: number;
  price_cents: number;
}

export interface OrderSummary {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  items: OrderItemSummary[];
  tracking: OrderTrackingSummary | null;
  archived?: boolean;
}

export interface OrderTrackingEvent {
  id: string;
  status: string;
  responsible_company: string | null;
  tracking_code: string | null;
  location: string | null;
  note: string | null;
  estimated_delivery: string | null;
  event_time: string;
}

export interface OrderTrackingSummary {
  latestStatus: string | null;
  statusLabel: string | null;
  responsible_company: string | null;
  tracking_code: string | null;
  location: string | null;
  estimated_delivery: string | null;
  updated_at: string | null;
  events: OrderTrackingEvent[];
}

export interface ProfileSummaryPayload {
  profile: ProfileContactInfo | null;
  membership: MembershipSnapshot;
  wallet: WalletRecord | null;
  orders: OrderSummary[];
  networkEarnings: NetworkEarningsSnapshot | null;
  payoutAccount: PayoutAccountSnapshot | null;
}
