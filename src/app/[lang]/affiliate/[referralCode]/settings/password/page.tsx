'use client';

import { useState, use } from 'react';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface AffiliatePasswordPageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

export default function AffiliatePasswordPage({ params }: AffiliatePasswordPageProps) {
  const { lang, referralCode } = use(params);
  const _dict = useAppDictionary();
  const { toast } = useToast();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters long' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Success', description: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">Change Password</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2">Update your password for better security.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="current-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="Enter current password"
                required
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="Enter new password"
                required
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Must be at least 8 characters long, contain a number, and a special character.</p>
            </div>
            <div>
              <Label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="Confirm new password"
                required
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading} className="w-full md:w-auto px-6 py-3 bg-primary text-background-dark font-bold rounded-lg hover:opacity-90 transition-opacity">
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}

