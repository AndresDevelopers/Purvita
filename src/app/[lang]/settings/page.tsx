'use client';

import { use, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { LucideIcon } from 'lucide-react';
import { User, Lock, Bell, Shield, ShieldCheck, ChevronRight, CreditCard, Megaphone, Mail, Users, Wallet } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import { useRouter } from 'next/navigation';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { getCurrentUserProfile } from '@/lib/services/user-service';
import { supabase } from '@/lib/supabase';

interface SettingsPageProps {
  params: Promise<{
    lang: Locale;
  }>;
}

type SubscriptionType = 'mlm' | 'affiliate' | null;

export default function SettingsPage({ params }: SettingsPageProps) {
  const { lang } = use(params);
  const dict = useAppDictionary();
  const router = useRouter();

  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>(null);

  useEffect(() => {
    let ignore = false;

    const resolveSubscriptionAccess = async () => {
      try {
        const profile = await getCurrentUserProfile();

        if (ignore) {
          return;
        }

        // Check if user has paid subscription (pay = true)
        const hasPaidSubscription = Boolean(profile?.pay);

        // Check subscription details from subscriptions table
        let hasManualSubscription = false;
        let subType: SubscriptionType = null;
        
        if (profile?.id) {
          try {
            // Get the active subscription with its type
            const { data: subscription, error } = await supabase
              .from('subscriptions')
              .select('status, subscription_type')
              .eq('user_id', profile.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!error && subscription) {
              hasManualSubscription = true;
              subType = subscription.subscription_type as SubscriptionType;
            }
          } catch (subError) {
            console.warn('[SettingsPage] Failed to check subscription table:', subError);
          }
        }

        // Show subscription-specific menus based on type
        setHasActiveSubscription(hasPaidSubscription || hasManualSubscription);
        setSubscriptionType(subType);
      } catch (error) {
        if (!ignore) {
          console.error('[SettingsPage] Failed to load user profile for subscription check', error);
          setHasActiveSubscription(false);
          setSubscriptionType(null);
        }
      }
    };

    void resolveSubscriptionAccess();

    return () => {
      ignore = true;
    };
  }, []);

  const settingsCopy = dict.settings;

  type SettingsItem = {
    key: string;
    icon: LucideIcon;
    title: string;
    description: string;
    href: string;
  };

  type SettingsSection = {
    key: string;
    title: string;
    items: SettingsItem[];
  };

  const accountItems: SettingsItem[] = [
    {
      key: 'profile',
      icon: User,
      title: settingsCopy.sections.account.items.profile.title,
      description: settingsCopy.sections.account.items.profile.description,
      href: `/${lang}/profile`,
    },
    {
      key: 'password',
      icon: Lock,
      title: settingsCopy.sections.account.items.password.title,
      description: settingsCopy.sections.account.items.password.description,
      href: `/${lang}/settings/password`,
    },
    {
      key: 'email',
      icon: Mail,
      title: settingsCopy.sections.account.items.email?.title ?? 'Email',
      description: settingsCopy.sections.account.items.email?.description ?? 'Update your email address.',
      href: `/${lang}/settings/email`,
    },
    {
      key: 'security',
      icon: ShieldCheck,
      title: (dict as any).mfa?.title ?? 'Two-Factor Authentication',
      description: (dict as any).mfa?.description ?? 'Add an extra layer of security with 2FA.',
      href: `/${lang}/settings/security`,
    },
  ];

  // Marketing - Only available for MLM subscription (not for Affiliate)
  if (hasActiveSubscription && subscriptionType === 'mlm') {
    accountItems.push({
      key: 'marketing',
      icon: Megaphone,
      title: settingsCopy.sections.account.items.marketing?.title ?? 'Marketing',
      description:
        settingsCopy.sections.account.items.marketing?.description ??
        'Accede a tus materiales y enlaces promocionales.',
      href: `/${lang}/marketing`,
    });
  }

  accountItems.push({
    key: 'subscription',
    icon: CreditCard,
    title: settingsCopy.sections.account.items.subscription.title,
    description: settingsCopy.sections.account.items.subscription.description,
    href: `/${lang}/settings/subscription`,
  });

  // MLM-only section: Network/Team management
  const mlmItems: SettingsItem[] = [];
  if (hasActiveSubscription && subscriptionType === 'mlm') {
    mlmItems.push(
      {
        key: 'team',
        icon: Users,
        title: settingsCopy.sections.network?.items?.team?.title ?? 'My Network',
        description: settingsCopy.sections.network?.items?.team?.description ?? 'Manage your team and view your multilevel network.',
        href: `/${lang}/team`,
      },
      {
        key: 'wallet',
        icon: Wallet,
        title: settingsCopy.sections.network?.items?.wallet?.title ?? 'Wallet',
        description: settingsCopy.sections.network?.items?.wallet?.description ?? 'Check your balance and withdraw your network commissions.',
        href: `/${lang}/wallet`,
      },
    );
  }

  const sections: SettingsSection[] = [
    {
      key: 'account',
      title: settingsCopy.sections.account.title,
      items: accountItems,
    },
    // MLM-only section: Network management (only for MLM subscription)
    ...(mlmItems.length > 0 ? [{
      key: 'network',
      title: settingsCopy.sections.network?.title ?? 'Multilevel Network',
      items: mlmItems,
    }] : []),
    {
      key: 'notifications',
      title: settingsCopy.sections.notifications.title,
      items: [
        {
          key: 'preferences',
          icon: Bell,
          title: settingsCopy.sections.notifications.items.preferences.title,
          description: settingsCopy.sections.notifications.items.preferences.description,
          href: `/${lang}/settings/notifications`,
        },
      ],
    },
    {
      key: 'privacy',
      title: settingsCopy.sections.privacy.title,
      items: [
        {
          key: 'privacy',
          icon: Shield,
          title: settingsCopy.sections.privacy.items.privacy.title,
          description: settingsCopy.sections.privacy.items.privacy.description,
          href: `/${lang}/settings/privacy`,
        },
      ],
    },
  ];

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{settingsCopy.title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{settingsCopy.description}</p>
          </div>
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.key}>
                <h2 className="mb-4 border-b border-primary/20 pb-2 text-xl font-bold text-gray-900 dark:border-primary/30 dark:text-white">
                  {section.title}
                </h2>
                <ul className="space-y-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => router.push(item.href)}
                          className="flex w-full items-center justify-between rounded-lg p-4 text-left transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-primary/20"
                        >
                          <div className="flex items-center gap-4">
                            <div className="rounded-lg bg-primary/20 p-3 dark:bg-primary/30">
                              <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-100">{item.title}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}