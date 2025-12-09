import type { Locale } from '@/i18n/config';
import { notFound, redirect } from 'next/navigation';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import { UserDetailsContent } from './user-details-content';
import { createClient } from '@supabase/supabase-js';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { NetworkEarningsRepository } from '@/modules/multilevel/repositories/network-earnings-repository';
import { AdminAuthService } from '@/lib/services/admin-auth-service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

async function fetchUser(id: string) {
  try {
    const supabaseAdmin = getAdminClient();

    console.log('[fetchUser] Starting fetch for user ID:', id);

    const [profileResult, subscription, wallet, networkEarnings, phase, rewards] = await Promise.all([
      supabaseAdmin.from('profiles').select(`
        *,
        role_name:roles(name)
      `).eq('id', id).maybeSingle(),
      new SubscriptionRepository(supabaseAdmin).findByUserId(id),
      new WalletService(supabaseAdmin).getBalance(id),
      new NetworkEarningsRepository(supabaseAdmin).fetchAvailableSummary(id),
      supabaseAdmin.from('phases').select('*').eq('user_id', id).maybeSingle(),
      supabaseAdmin.rpc('get_active_phase_rewards', { p_user_id: id }),
    ]);

    console.log('[fetchUser] Profile result:', { data: profileResult.data, error: profileResult.error });
    console.log('[fetchUser] Phase result:', { data: phase.data, error: phase.error });
    console.log('[fetchUser] Rewards result:', { data: rewards.data, error: rewards.error });

    if (profileResult.error) {
      console.error('[fetchUser] Error fetching profile:', profileResult.error);
      return null;
    }

    if (!profileResult.data) {
      console.error('[fetchUser] Profile not found for ID:', id);
      return null;
    }

    if (phase.error) {
      console.error('[fetchUser] Error fetching phase:', phase.error);
    }

    if (rewards.error) {
      console.error('[fetchUser] Error fetching rewards:', rewards.error);
    }

    return {
      profile: profileResult.data,
      subscription,
      wallet,
      networkEarnings,
      phase: phase.data,
      rewards: rewards.data && rewards.data.length > 0 ? rewards.data[0] : null,
    };
  } catch (error) {
    console.error('[fetchUser] Unexpected error fetching user:', error);
    return null;
  }
}

export default async function UserDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: Locale }>;
}) {
  // Verify admin authentication
  try {
    await AdminAuthService.verifyAdminAccess();
  } catch (error) {
    console.error('[UserDetailsPage] Admin auth failed:', error);
    redirect('/admin/login');
  }

  const { id } = await params;
  const search = await searchParams;
  const lang = (search.lang || 'en') as Locale;
  const dict = await getLocalizedDictionary(lang);

  console.log('[UserDetailsPage] Fetching user with ID:', id);
  const user = await fetchUser(id);

  if (!user) {
    console.error('[UserDetailsPage] fetchUser returned null for ID:', id);
    notFound();
  }

  if (!user.profile) {
    console.error('[UserDetailsPage] User profile is null for ID:', id);
    notFound();
  }

  console.log('[UserDetailsPage] Successfully loaded user:', user.profile.email);
  return <UserDetailsContent userId={id} lang={lang} dict={dict} initialUser={user.profile} />;
}
