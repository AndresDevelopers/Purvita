import { supabase } from '@/lib/supabase';

const getSupabaseClient = () => {
  return supabase;
};

export const getActiveSubscriptionsCount = async (): Promise<number> => {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) {
    console.warn('Error getting active subscriptions count:', error);
    return 0;
  }

  return count ?? 0;
};

export const getWaitlistedSubscriptionsCount = async (): Promise<number> => {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('waitlisted', true);

  if (error) {
    console.warn('Error getting waitlisted subscriptions count:', error);
    return 0;
  }

  return count ?? 0;
};

export const getSubscriptionRevenue = async (): Promise<number> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('payments')
    .select('amount_cents')
    .eq('status', 'paid')
    .eq('kind', 'subscription');

  if (error) {
    console.warn('Error getting subscription revenue:', error);
    return 0;
  }

  return (data as any[] ?? []).reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
};

export const getOrderRevenue = async (): Promise<number> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('orders')
    .select('total_cents')
    .eq('status', 'paid');

  if (error) {
    console.warn('Error getting order revenue:', error);
    return 0;
  }

  return (data as any[] ?? []).reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
};

export const getTotalWalletBalance = async (): Promise<number> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('wallets')
    .select('balance_cents');

  if (error) {
    console.warn('Error getting total wallet balance:', error);
    return 0;
  }

  return (data as any[] ?? []).reduce((sum, wallet) => sum + (wallet.balance_cents ?? 0), 0);
};

export const getPhaseDistribution = async (): Promise<Array<{ phase: number; count: number; percentage: number }>> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('phases')
    .select('phase, user_id');

  if (error) {
    console.warn('Error getting phase distribution:', error);
    return [];
  }

  const phaseCounts: Record<number, number> = {};
  const totalUsers = (data as any[] ?? []).length;

  (data as any[] ?? []).forEach((record) => {
    const phase = record.phase ?? 0;
    phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
  });

  return [0, 1, 2, 3].map((phase) => ({
    phase,
    count: phaseCounts[phase] ?? 0,
    percentage: totalUsers > 0 ? ((phaseCounts[phase] ?? 0) / totalUsers) * 100 : 0,
  }));
};