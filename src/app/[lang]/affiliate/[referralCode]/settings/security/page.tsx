'use client';

/**
 * Affiliate Security Settings Page
 * 
 * Page for managing security settings including Two-Factor Authentication.
 */

import { use } from 'react';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { MfaSetupCard } from '@/modules/mfa/components/mfa-setup-card';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SecuritySettingsPageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

export default function SecuritySettingsPage({ params }: SecuritySettingsPageProps) {
  const { lang, referralCode } = use(params);
  const dict = useAppDictionary();
  const router = useRouter();
  const { toast } = useToast();

  // Get MFA dictionary from app dictionary if available
  const mfaDictionary = (dict as any).mfa || undefined;

  const handleMfaStatusChange = (enabled: boolean) => {
    toast({
      title: enabled 
        ? (mfaDictionary?.success?.enabled || 'Two-factor authentication enabled')
        : (mfaDictionary?.success?.disabled || 'Two-factor authentication disabled'),
      description: enabled
        ? 'Your account is now more secure.'
        : 'Two-factor authentication has been disabled.',
      variant: enabled ? 'default' : 'destructive',
    });
  };

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {'Back'}
          </Button>

          {/* Page Header */}
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {mfaDictionary?.title || 'Security Settings'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {mfaDictionary?.description || 'Manage your account security settings'}
            </p>
          </div>

          {/* MFA Setup Card */}
          <MfaSetupCard
            dictionary={mfaDictionary}
            onStatusChange={handleMfaStatusChange}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
