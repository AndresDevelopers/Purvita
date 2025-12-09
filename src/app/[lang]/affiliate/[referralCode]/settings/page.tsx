'use client';

import { use, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { LucideIcon } from 'lucide-react';
import { User, Lock, Bell, Shield, ShieldCheck, ChevronRight, Store, Mail, BarChart3 } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import { useRouter } from 'next/navigation';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { supabase, getSafeSession as _getSafeSession } from '@/lib/supabase';

interface AffiliateSettingsPageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

export default function AffiliateSettingsPage({ params }: AffiliateSettingsPageProps) {
  const { lang, referralCode } = use(params);
  const dict = useAppDictionary();
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [_loading, setLoading] = useState(true);

  const settingsCopy = dict.settings;

  // ✅ SECURITY: Check if current user is the owner AND has active subscription using server-side API
  useEffect(() => {
    const checkOwnershipAndSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setLoading(false);
          return;
        }

        // Use server-side validation endpoint for security
        const response = await fetch(`/api/affiliate/${referralCode}/validate-ownership`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setIsOwner(true);
          setHasActiveSubscription(true);
        } else if (data.requiresSubscription) {
          // User is owner but no active subscription - still show settings but not store section
          // Check if user is owner without subscription
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, referral_code')
            .ilike('referral_code', referralCode)
            .single();

          if (profile?.id === session.user.id) {
            setIsOwner(true);
            setHasActiveSubscription(false);
          }
        }
      } catch (error) {
        console.error('Error checking ownership and subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    checkOwnershipAndSubscription();
  }, [referralCode, lang, router]);

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

  // Account section - WITHOUT Marketing and Subscription
  const accountItems: SettingsItem[] = [
    {
      key: 'profile',
      icon: User,
      title: settingsCopy.sections.account.items.profile.title,
      description: settingsCopy.sections.account.items.profile.description,
      href: `/${lang}/affiliate/${referralCode}/profile`,
    },
    {
      key: 'password',
      icon: Lock,
      title: settingsCopy.sections.account.items.password.title,
      description: settingsCopy.sections.account.items.password.description,
      href: `/${lang}/affiliate/${referralCode}/settings/password`,
    },
    {
      key: 'email',
      icon: Mail,
      title: settingsCopy.sections.account.items.email?.title ?? 'Email',
      description: settingsCopy.sections.account.items.email?.description ?? 'Update your email address.',
      href: `/${lang}/affiliate/${referralCode}/settings/email`,
    },
    {
      key: 'security',
      icon: ShieldCheck,
      title: (settingsCopy.sections.account.items as any).security?.title ?? 'Two-Factor Authentication',
      description: (settingsCopy.sections.account.items as any).security?.description ?? 'Add an extra layer of security with 2FA.',
      href: `/${lang}/affiliate/${referralCode}/settings/security`,
    },
  ];

  // Store section - ONLY for store owners WITH active subscription
  // ✅ SECURITY: Only show store customization and analytics if user is owner AND has active subscription
  const storeSection: SettingsSection | null = (isOwner && hasActiveSubscription) ? {
    key: 'store',
    title: settingsCopy.sections.store?.title ?? 'Store',
    items: [
      {
        key: 'customization',
        icon: Store,
        title: settingsCopy.sections.store?.items?.customization?.title ?? 'Store Customization',
        description: settingsCopy.sections.store?.items?.customization?.description ?? 'Customize your affiliate store appearance.',
        href: `/${lang}/affiliate/${referralCode}/settings/store`,
      },
      {
        key: 'analytics',
        icon: BarChart3,
        title: settingsCopy.sections.account.items.analytics?.title ?? 'Analytics',
        description: settingsCopy.sections.account.items.analytics?.description ?? 'View metrics and statistics for your store.',
        href: `/${lang}/affiliate/${referralCode}/analytics`,
      },
    ],
  } : null;

  const sections: SettingsSection[] = [
    {
      key: 'account',
      title: settingsCopy.sections.account.title,
      items: accountItems,
    },
    // Add store section if user is owner
    ...(storeSection ? [storeSection] : []),
    {
      key: 'notifications',
      title: settingsCopy.sections.notifications.title,
      items: [
        {
          key: 'preferences',
          icon: Bell,
          title: settingsCopy.sections.notifications.items.preferences.title,
          description: settingsCopy.sections.notifications.items.preferences.description,
          href: `/${lang}/affiliate/${referralCode}/settings/notifications`,
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
          href: `/${lang}/affiliate/${referralCode}/settings/privacy`,
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

