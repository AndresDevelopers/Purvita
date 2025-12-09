import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { notFound, redirect } from 'next/navigation';
import EditUserForm from './edit-user-form';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import { getUserById } from '@/lib/services/user-service';
import { CopyUserIdButton } from '@/components/admin/copy-user-id-button';
import { ImpersonateUserButton } from './impersonate-user-button';
import { AdminAuthService } from '@/lib/services/admin-auth-service';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { NetworkEarningsRepository } from '@/modules/multilevel/repositories/network-earnings-repository';
import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchAdminUserBundle(id: string) {
  try {
    const supabaseAdmin = getAdminClient();

    console.log('[AdminEditUser] Starting fetch for user ID:', id);

    const [profileResult, subscription, wallet, networkEarnings, phase, rewards, blacklistResult] = await Promise.all([
      supabaseAdmin.from('profiles').select(`
        *,
        role_name:roles(name)
      `).eq('id', id).maybeSingle(),
      new SubscriptionRepository(supabaseAdmin).findByUserId(id),
      new WalletService(supabaseAdmin).getBalance(id),
      new NetworkEarningsRepository(supabaseAdmin).fetchAvailableSummary(id),
      supabaseAdmin.from('phases').select('*').eq('user_id', id).maybeSingle(),
      supabaseAdmin.rpc('get_active_phase_rewards', { p_user_id: id }),
      // Check if user is in security blacklist (get reason for tooltip)
      supabaseAdmin.from('user_blacklist').select('id, reason, fraud_type').eq('user_id', id).maybeSingle(),
    ]);

    console.log('[AdminEditUser] Profile result:', { data: profileResult.data, error: profileResult.error });
    console.log('[AdminEditUser] Phase result:', { data: phase.data, error: phase.error });
    console.log('[AdminEditUser] Rewards result:', { data: rewards.data, error: rewards.error });

    if (profileResult.error) {
      console.error('[AdminEditUser] Error fetching profile:', profileResult.error);
      return null;
    }

    if (!profileResult.data) {
      console.error('[AdminEditUser] Profile not found for ID:', id);
      return null;
    }

    if (phase.error) {
      console.error('[AdminEditUser] Error fetching phase:', phase.error);
    }

    if (rewards.error) {
      console.error('[AdminEditUser] Error fetching rewards:', rewards.error);
    }

    return {
      profile: profileResult.data,
      subscription,
      wallet,
      networkEarnings,
      phase: phase.data,
      rewards: rewards.data && rewards.data.length > 0 ? rewards.data[0] : null,
      isBlacklisted: !!blacklistResult.data,
      blacklistReason: blacklistResult.data?.reason ?? null,
      blacklistFraudType: blacklistResult.data?.fraud_type ?? null,
    };
  } catch (error) {
    console.error('[AdminEditUser] Unexpected error fetching user:', error);
    return null;
  }
}

export default async function EditUserPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ lang?: Locale }> }) {
  // Verify admin authentication
  try {
    await AdminAuthService.verifyAdminAccess();
  } catch (error) {
    console.error('[EditUserPage] Admin auth failed:', error);
    redirect('/admin/login');
  }

  const { id } = await params;
  const { lang = 'en' } = await searchParams;
  const dict = await getLocalizedDictionary(lang);

  console.log('[EditUserPage] Fetching user with ID:', id);
  const bundle = await fetchAdminUserBundle(id);

  if (!bundle || !bundle.profile) {
    console.error('[EditUserPage] fetchAdminUserBundle returned null for ID:', id);
    notFound();
  }

  const user = bundle.profile;
  const referrer = user.referred_by ? await getUserById(user.referred_by) : null;

  return (
    <div>
      <Button variant="ghost" asChild className="mb-4">
        <Link href={`/admin/users?lang=${lang}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {dict.admin.backToUsers}
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{dict.admin.editUser}</CardTitle>
          <CardDescription>{dict.admin.editUserDesc} &quot;{user.name}&quot;</CardDescription>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">User ID</p>
              <code className="text-sm font-mono text-slate-900 dark:text-slate-100">{user.id}</code>
            </div>
            <CopyUserIdButton text={user.id} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {dict.admin.impersonation.title}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {dict.admin.impersonation.description}
                </p>
              </div>
              <ImpersonateUserButton
                userId={user.id}
                lang={lang}
                copy={{
                  actionLabel: dict.admin.impersonation.actionLabel,
                  busyLabel: dict.admin.impersonation.busyLabel,
                  errorTitle: dict.admin.impersonation.errorTitle,
                  errorDescription: dict.admin.impersonation.errorDescription,
                }}
                isUserBlocked={user.status !== 'active' || bundle.isBlacklisted}
                blockReason={bundle.blacklistReason}
              />
            </div>
          </div>
          <EditUserForm
            user={user}
            lang={lang}
            subscription={bundle.subscription ?? undefined}
            walletBalanceCents={bundle.wallet?.balance_cents ?? 0}
            networkEarningsCents={bundle.networkEarnings?.totalAvailableCents ?? 0}
            referrer={referrer ?? undefined}
            phase={bundle.phase ?? undefined}
            rewards={bundle.rewards ?? undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
